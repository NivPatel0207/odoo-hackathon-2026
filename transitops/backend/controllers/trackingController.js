const LocationTelemetry = require('../models/LocationTelemetry');

exports.getLiveTracking = async (req, res, next) => {
  try {
    // We want the latest telemetry per driver
    const liveLocations = await LocationTelemetry.aggregate([
      { $sort: { recordedAt: -1 } },
      { 
        $group: {
          _id: "$driver",
          latestRecord: { $first: "$$ROOT" }
        }
      },
      {
        $lookup: {
          from: 'drivers',
          localField: '_id',
          foreignField: '_id',
          as: 'driverInfo'
        }
      },
      { $unwind: "$driverInfo" },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'latestRecord.vehicle',
          foreignField: '_id',
          as: 'vehicleInfo'
        }
      },
      {
        $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: 'trips',
          localField: 'latestRecord.trip',
          foreignField: '_id',
          as: 'tripInfo'
        }
      },
      {
        $unwind: { path: "$tripInfo", preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          _id: 0,
          driver: {
            _id: "$driverInfo._id",
            name: "$driverInfo.name",
            licenseNumber: "$driverInfo.licenseNumber"
          },
          vehicle: {
            _id: "$vehicleInfo._id",
            registrationNumber: "$vehicleInfo.registrationNumber"
          },
          trip: {
            _id: "$tripInfo._id",
            tripCode: "$tripInfo.tripCode",
            source: "$tripInfo.source",
            destination: "$tripInfo.destination"
          },
          coordinates: "$latestRecord.location.coordinates",
          speed: "$latestRecord.speed",
          heading: "$latestRecord.heading",
          accuracy: "$latestRecord.accuracy",
          recordedAt: "$latestRecord.recordedAt"
        }
      }
    ]);

    // Calculate stale status dynamically
    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes

    const data = liveLocations.map(loc => {
      return {
        ...loc,
        isStale: (now - new Date(loc.recordedAt)) > staleThreshold
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
