const fs = require('fs');

const html = fs.readFileSync('frontend/payroll.html', 'utf8');
const js = fs.readFileSync('frontend/js/pages/payroll.js', 'utf8');

const idMatches = [...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);
const uniqueIds = [...new Set(idMatches)];
console.log('Unique IDs queried in JS:', uniqueIds.length);

const missingIds = uniqueIds.filter(id => !html.includes(`id="${id}"`) && !html.includes(`id='${id}'`));
if (missingIds.length > 0) {
  console.log('WARNING Missing IDs in HTML:', missingIds);
} else {
  console.log('SUCCESS: All element IDs referenced in payroll.js exist in payroll.html!');
}

// Check window functions called from html inline onclick / oninput / onchange
const fnMatches = [...html.matchAll(/on\w+="([a-zA-Z0-9_]+)\(/g)].map(m => m[1]);
const uniqueFns = [...new Set(fnMatches)];
console.log('Unique inline handlers in HTML:', uniqueFns);

const missingFns = uniqueFns.filter(fn => !js.includes(`window.${fn} =`) && !js.includes(`function ${fn}(`));
if (missingFns.length > 0) {
  console.log('WARNING Missing functions in JS:', missingFns);
} else {
  console.log('SUCCESS: All HTML inline event handlers are defined in payroll.js!');
}
