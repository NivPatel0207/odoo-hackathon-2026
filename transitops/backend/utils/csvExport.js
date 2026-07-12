/**
 * CSV Export Utility
 * Streams an array of objects as a CSV file download
 */
const exportToCsv = (res, data, filename = 'export') => {
  if (!data || data.length === 0) {
    return res.status(404).json({ success: false, message: 'No data to export' });
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        // Escape quotes and wrap in quotes if contains comma or newline
        const strVal = String(val).replace(/"/g, '""');
        return `"${strVal}"`;
      }).join(',')
    )
  ];

  const csvContent = csvRows.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.csv"`);
  res.send(csvContent);
};

module.exports = { exportToCsv };
