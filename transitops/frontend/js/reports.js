document.addEventListener('DOMContentLoaded', () => {
  if (!auth.requireAuth()) return;
  nav.render('reports');

  if (!auth.can('financial_analyst', 'fleet_manager')) {
    const btn = document.getElementById('btn-export');
    const btnPdf = document.getElementById('btn-export-pdf');
    if (btn) btn.style.display = 'none';
    if (btnPdf) btnPdf.style.display = 'none';
  }

  loadReports();
});

async function loadReports() {
  try {
    loading.show();
    const [effRes, costRes] = await Promise.all([
      api.getFuelEfficiency(),
      api.getOperationalCost()
    ]);
    
    if (effRes.success) renderEfficiencyTable(effRes.data);
    if (costRes.success) renderCostTable(costRes.data);
  } catch (err) {
    toast.error('Failed to load reports', err.message);
  } finally {
    loading.hide();
  }
}

function renderEfficiencyTable(data) {
  const tbody = document.getElementById('efficiency-table-body');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">No data available.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(row => `
    <tr>
      <td><div class="primary-text">${row.vehicleName}</div></td>
      <td><div class="primary-text font-mono">${row.regNumber}</div></td>
      <td>${fmt.number(row.totalDistance)}</td>
      <td>${fmt.number(row.totalFuel)}</td>
      <td class="font-bold ${row.kmPerLiter >= 5 ? 'text-success' : 'text-danger'}">${fmt.number(row.kmPerLiter)} km/L</td>
      <td>${row.tripCount}</td>
    </tr>
  `).join('');
}

function renderCostTable(data) {
  const tbody = document.getElementById('cost-table-body');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted py-4">No data available.</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(row => `
    <tr>
      <td><div class="primary-text">${row.name}</div></td>
      <td><div class="primary-text font-mono">${row.registrationNumber}</div></td>
      <td class="text-danger">${fmt.currency(row.maintenanceCost)}</td>
      <td class="text-danger">${fmt.currency(row.fuelCost)}</td>
      <td class="text-danger">${fmt.currency(row.expenseCost)}</td>
      <td class="font-bold text-danger">${fmt.currency(row.totalCost)}</td>
      <td class="text-success">${fmt.currency(row.revenue)}</td>
      <td class="font-bold ${row.profit >= 0 ? 'text-success' : 'text-danger'}">${fmt.currency(row.profit)}</td>
    </tr>
  `).join('');
}

function exportCSV() {
  window.open(api.exportTripsCSV(), '_blank');
}

async function exportPDF() {
  if (typeof html2pdf === 'undefined') {
    toast.error('PDF Library not loaded yet.');
    return;
  }
  
  loading.show();
  try {
    const element = document.getElementById('report-content');
    
    // Store original styles to revert later
    const originalPadding = element.style.padding;
    const originalPosition = element.style.position;
    
    // We will not force a fixed width to avoid left-side cutoffs. 
    // Instead, we just pad the element for the PDF.
    element.style.padding = '20px';
    
    // Inject light-theme CSS to make it a standard printable document (Black text on White A4)
    const printStyle = document.createElement('style');
    printStyle.innerHTML = `
      #report-content {
        --color-bg-primary: #ffffff !important;
        --color-bg-secondary: #f8fafc !important;
        --color-bg-card: #ffffff !important;
        --color-text-primary: #000000 !important;
        --color-text-secondary: #333333 !important;
        --color-text-muted: #555555 !important;
        --color-border: #cccccc !important;
        color: #000000 !important;
        background: #ffffff !important;
      }
      #report-content .card { box-shadow: none !important; border: 1px solid #ccc !important; margin-bottom: 20px !important; width: 100% !important; box-sizing: border-box !important; }
      #report-content .card-header { padding: 10px !important; }
      #report-content .card-title { font-size: 16px !important; margin: 0 !important; }
      #report-content .table-wrapper { overflow: visible !important; margin-top: 10px !important; width: 100% !important; }
      #report-content .data-table { font-size: 10px !important; width: 100% !important; }
      #report-content .data-table th { background: #f0f0f0 !important; color: #000 !important; font-weight: bold !important; border-bottom: 2px solid #aaa !important; padding: 6px !important; text-align: left !important; }
      #report-content .data-table td { color: #000 !important; border-bottom: 1px solid #eee !important; padding: 6px !important; text-align: left !important; }
      #report-content .text-success { color: #10b981 !important; }
      #report-content .text-danger { color: #ef4444 !important; }
      #report-content .primary-text { color: #000 !important; }
    `;
    document.head.appendChild(printStyle);
    
    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4], 
      filename:     `TransitOps_Report_${new Date().toISOString().split('T')[0]}.pdf`,
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'landscape' } // Landscape gives more horizontal room for wide tables
    };
    
    // Create a beautiful header for the PDF
    const headerDiv = document.createElement('div');
    headerDiv.id = 'pdf-temp-header';
    headerDiv.style.textAlign = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.style.borderBottom = '2px solid #cccccc';
    headerDiv.style.paddingBottom = '10px';
    
    headerDiv.innerHTML = `
      <div style="font-family: 'Poppins', sans-serif; font-size: 20px; font-weight: 700; color: #000000; margin-bottom: 3px;">
        🚚 TransitOps Platform
      </div>
      <div style="font-family: 'Inter', sans-serif; font-size: 14px; color: #333333;">
        Official Financial & Efficiency Report
      </div>
      <div style="font-family: 'Inter', sans-serif; font-size: 10px; color: #666666; margin-top: 3px;">
        Generated on: ${new Date().toLocaleString()}
      </div>
    `;
    
    element.prepend(headerDiv);
    
    // Small delay to ensure CSS applies
    await new Promise(r => setTimeout(r, 100));
    
    await html2pdf().set(opt).from(element).save();
    
    // Cleanup temporary PDF elements
    element.removeChild(headerDiv);
    document.head.removeChild(printStyle);
    element.style.padding = originalPadding;
    element.style.position = originalPosition;
    
    toast.success('PDF generated successfully!');
  } catch (err) {
    toast.error('Failed to generate PDF', err.message);
  } finally {
    loading.hide();
  }
}
