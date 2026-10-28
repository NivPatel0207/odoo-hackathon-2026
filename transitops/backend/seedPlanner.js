const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Event = require('./models/Event');
const connectDB = require('./config/db');

dotenv.config();

const seedEvents = async () => {
  await connectDB();
  
  // Clear existing first
  await Event.deleteMany({});
  
  // Calculate current week's Monday
  const currentWeekStart = new Date();
  currentWeekStart.setDate(currentWeekStart.getDate() - (currentWeekStart.getDay() || 7) + 1);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  const events = [];
  
  const getSlot = (dayOffset, startHour, durationHours) => {
    const start = new Date(currentWeekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(startHour, 0, 0, 0);
    
    const end = new Date(start);
    end.setHours(startHour + durationHours, 0, 0, 0);
    return { start, end };
  };

  // Monday
  const slot1 = getSlot(0, 9, 2);
  events.push({ title: 'Morning Standup', type: 'Meeting', startTime: slot1.start, endTime: slot1.end, description: 'Weekly sync with the fleet team', status: 'Planned' });
  
  const slot2 = getSlot(0, 13, 4);
  events.push({ title: 'Bus 102 Maintenance', type: 'Maintenance', startTime: slot2.start, endTime: slot2.end, description: 'Oil change and brake check', status: 'Ongoing' });

  // Tuesday
  const slot3 = getSlot(1, 7, 8);
  events.push({ title: 'Morning Shift - John Doe', type: 'Driver Shift', startTime: slot3.start, endTime: slot3.end, description: 'Route A morning block', status: 'Planned' });

  const slot4 = getSlot(1, 16, 2);
  events.push({ title: 'Safety Training', type: 'Meeting', startTime: slot4.start, endTime: slot4.end, description: 'Mandatory safety protocol review', status: 'Planned' });

  // Wednesday
  const slot5 = getSlot(2, 6, 4);
  events.push({ title: 'Airport Express Trip', type: 'Trip', startTime: slot5.start, endTime: slot5.end, description: 'Charter trip to international airport', status: 'Planned' });
  
  const slot6 = getSlot(2, 11, 3);
  events.push({ title: 'Vendor Sync', type: 'Meeting', startTime: slot6.start, endTime: slot6.end, description: 'Meeting with parts suppliers', status: 'Planned' });

  // Thursday
  const slot7 = getSlot(3, 8, 3);
  events.push({ title: 'Fleet Inspection', type: 'Maintenance', startTime: slot7.start, endTime: slot7.end, description: 'Quarterly state inspection for buses 1-5', status: 'Planned' });
  
  const slot8 = getSlot(3, 14, 5);
  events.push({ title: 'Afternoon Shift - Jane Smith', type: 'Driver Shift', startTime: slot8.start, endTime: slot8.end, description: 'Route B afternoon block', status: 'Planned' });

  // Friday
  const slot9 = getSlot(4, 9, 2);
  events.push({ title: 'Performance Review', type: 'Meeting', startTime: slot9.start, endTime: slot9.end, description: 'Monthly KPI review', status: 'Planned' });

  const slot10 = getSlot(4, 12, 6);
  events.push({ title: 'Weekend Charter Prep', type: 'Maintenance', startTime: slot10.start, endTime: slot10.end, description: 'Deep cleaning and fuel top-off', status: 'Planned' });

  // Saturday
  const slot11 = getSlot(5, 10, 8);
  events.push({ title: 'Downtown Festival Route', type: 'Trip', startTime: slot11.start, endTime: slot11.end, description: 'Special routing for the city festival', status: 'Planned' });

  try {
    await Event.insertMany(events);
    console.log('✅ Mock planner events seeded successfully!');
    process.exit();
  } catch (error) {
    console.error('❌ Error seeding events:', error);
    process.exit(1);
  }
};

seedEvents();
