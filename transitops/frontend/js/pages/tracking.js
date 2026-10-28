document.addEventListener('DOMContentLoaded', async () => {
  if (!auth.requireAuth(['fleet_manager', 'dispatcher', 'safety_officer'])) return;

  nav.render('tracking');

  // Initialize Google Maps
  const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#0a0e1a" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0a0e1a" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2236" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e2d4a" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#263354" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2563eb" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e2d4a" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#111827" }] }
  ];

  const map = new google.maps.Map(document.getElementById('map'), {
    zoom: 5,
    center: { lat: 39.8283, lng: -98.5795 }, // Default US Center
    styles: darkMapStyle,
    disableDefaultUI: true,
    zoomControl: true,
    backgroundColor: '#0a0e1a'
  });

  const markers = {};
  
  // Normal truck (amber) vs Stale truck (gray)
  const truckSvgLive = `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#f59e0b" />
      <circle cx="12" cy="12" r="11" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4" />
    </svg>`);
    
  const truckSvgStale = `data:image/svg+xml;charset=UTF-8,` + encodeURIComponent(`
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="#64748b" />
      <circle cx="12" cy="12" r="11" stroke="#64748b" stroke-width="2" />
    </svg>`);

  async function fetchLiveTracking() {
    try {
      const res = await api.get('/tracking/live');
      if (res.success && res.data) {
        
        document.getElementById('active-count').innerText = `${res.data.length} Tracked Vehicles`;
        document.getElementById('hud-active').innerText = res.data.length;
        
        let staleCount = 0;
        
        const allBounds = new google.maps.LatLngBounds();
        let shouldFitBounds = Object.keys(markers).length === 0; // only auto-zoom on first load
        
        res.data.forEach(telemetry => {
          const lat = telemetry.coordinates[1];
          const lng = telemetry.coordinates[0];
          const pos = { lat, lng };
          
          allBounds.extend(pos);
          if (telemetry.isStale) staleCount++;
          
          if (!markers[telemetry.driver._id]) {
            // Create new marker
            const marker = new google.maps.Marker({
              position: pos,
              map: map,
              icon: {
                url: telemetry.isStale ? truckSvgStale : truckSvgLive,
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
              }
            });
            
            const infoWindow = new google.maps.InfoWindow();
            marker.addListener('click', () => {
              const popupContent = `
                <div class="truck-popup">
                  <div class="truck-popup-title">${telemetry.vehicle ? telemetry.vehicle.registrationNumber : 'No Vehicle'}</div>
                  <div class="truck-popup-body">
                    <strong>Driver:</strong> ${telemetry.driver.name}<br>
                    <strong>Speed:</strong> ${telemetry.speed ? (telemetry.speed * 3.6).toFixed(1) + ' km/h' : 'N/A'}<br>
                    <strong>Status:</strong> ${telemetry.isStale ? 'Stale (>5m)' : 'Live'}<br>
                    <strong>Last Update:</strong> ${new Date(telemetry.recordedAt).toLocaleTimeString()}
                  </div>
                </div>
              `;
              infoWindow.setContent(popupContent);
              infoWindow.open({ anchor: marker, map });
            });
            
            markers[telemetry.driver._id] = { marker, infoWindow };
          } else {
            // Update existing marker
            markers[telemetry.driver._id].marker.setPosition(pos);
            markers[telemetry.driver._id].marker.setIcon({
              url: telemetry.isStale ? truckSvgStale : truckSvgLive,
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 12)
            });
          }
        });
        
        // Remove markers for drivers no longer sharing
        const currentDriverIds = res.data.map(d => d.driver._id);
        for (const id in markers) {
          if (!currentDriverIds.includes(id)) {
            markers[id].marker.setMap(null);
            delete markers[id];
          }
        }
        
        if (shouldFitBounds && currentDriverIds.length > 0) {
          map.fitBounds(allBounds);
        }
        
        document.getElementById('hud-cargo').innerText = `${staleCount} Stale`;
      }
    } catch (error) {
      console.error('Failed to fetch tracking data', error);
    }
  }

  // Initial fetch
  fetchLiveTracking();
  
  // Poll every 10 seconds
  setInterval(fetchLiveTracking, 10000);
});
