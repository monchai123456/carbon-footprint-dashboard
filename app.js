// Global State
let allCsvRows = [];
let comparisonChart = null;
let s1BreakdownChart = null;
let s2BreakdownChart = null;
let currentComparisonView = "total"; // "total" or "monthly"

// DOM Elements
const selectYear = document.getElementById('select-year');
const selectMonth = document.getElementById('select-month');
const selectSite = document.getElementById('select-site');
const lastUpdatedTime = document.getElementById('last-updated-time');

// KPI fields
const kpiTotalVal = document.getElementById('kpi-total-val');
const kpiIntensityVal = document.getElementById('kpi-intensity-val');
const kpiS1Val = document.getElementById('kpi-s1-val');
const kpiS2Val = document.getElementById('kpi-s2-val');

// KPI trends
const trendS1Badge = document.getElementById('card-scope1').querySelector('.kpi-card-trend-badge');
const trendS2Badge = document.getElementById('card-scope2').querySelector('.kpi-card-trend-badge');

// Comparison labels
const compPrevYear = document.getElementById('comp-prev-year');
const compActiveYear = document.getElementById('comp-active-year');
const compTrendCircle = document.getElementById('comp-trend-circle');
const compTrendPctLabel = document.getElementById('comp-trend-pct-label');
const compTrendPrevYearLabel = document.getElementById('comp-trend-prev-year-label');

// Scope 1 Breakdown elements
const breakdownS1Plan = document.getElementById('breakdown-s1-plan');
const breakdownS1Actual = document.getElementById('breakdown-s1-actual');
const breakdownS1Circle = document.getElementById('breakdown-s1-circle');

// Scope 2 Breakdown elements
const breakdownS2Plan = document.getElementById('breakdown-s2-plan');
const breakdownS2Actual = document.getElementById('breakdown-s2-actual');
const breakdownS2Circle = document.getElementById('breakdown-s2-circle');

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Setup select listeners
  selectYear.addEventListener('change', updateDashboard);
  selectMonth.addEventListener('change', updateDashboard);
  selectSite.addEventListener('change', updateDashboard);

  // Setup view toggle listeners
  const btnTotal = document.getElementById('btn-view-total');
  const btnMonthly = document.getElementById('btn-view-monthly');
  
  if (btnTotal && btnMonthly) {
    btnTotal.addEventListener('click', () => {
      if (currentComparisonView === "total") return;
      currentComparisonView = "total";
      btnTotal.classList.add('active');
      btnMonthly.classList.remove('active');
      updateDashboard();
    });
    
    btnMonthly.addEventListener('click', () => {
      if (currentComparisonView === "monthly") return;
      currentComparisonView = "monthly";
      btnMonthly.classList.add('active');
      btnTotal.classList.remove('active');
      updateDashboard();
    });
  }
});

// Load and Parse CSV Data
async function loadData() {
  try {
    const response = await fetch('data.csv');
    if (!response.ok) throw new Error('Failed to fetch data.csv');
    const csvText = await response.text();
    
    // Parse using PapaParse
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    let rows = parsed.data;
    
    // Strip BOM from header keys
    if (rows.length > 0) {
      const firstRow = rows[0];
      const cleanedRow = {};
      Object.keys(firstRow).forEach(key => {
        const cleanedKey = key.replace(/^\ufeff/, '').trim();
        cleanedRow[cleanedKey] = firstRow[key];
      });
      
      // Re-map all rows to strip BOM
      rows = rows.map(r => {
        const newRow = {};
        Object.keys(r).forEach(key => {
          const cleanedKey = key.replace(/^\ufeff/, '').trim();
          newRow[cleanedKey] = r[key];
        });
        return newRow;
      });
    }
    
    allCsvRows = rows;
    
    // Initialize filter options dynamically
    populateFilters();
    
    // Dynamic Last Updated: find latest month & year in Detail rows
    updateDynamicLastUpdated();
    
    // Initial render
    updateDashboard();
  } catch (error) {
    console.error('Error loading CSV data:', error);
    alert('Error loading dashboard data. Please make sure data.csv exists.');
  }
}

// Helper to parse comma-separated numbers and glue extra fields from unquoted CSV commas
function getCleanRowValue(row) {
  let val = row.Value;
  if (row.__parsed_extra && row.__parsed_extra.length > 0) {
    val = val + "," + row.__parsed_extra.join(",");
  }
  return val ? parseFloat(val.toString().replace(/,/g, '')) || 0 : 0;
}

// Populate Dropdown Filters
function populateFilters() {
  const years = new Set();
  const sites = new Set();
  
  allCsvRows.forEach(r => {
    if (r.Year && r.Year !== "All Years" && r.Year !== "") years.add(r.Year);
    if (r.Site && r.Site !== "All Sites" && r.Site !== "") sites.add(r.Site);
  });
  
  // Save current selections
  const currentYear = selectYear.value;
  const currentMonth = selectMonth.value;
  const currentSite = selectSite.value;
  
  // Populate Year
  selectYear.innerHTML = '';
  const sortedYears = Array.from(years).sort().reverse();
  sortedYears.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    selectYear.appendChild(opt);
  });
  // Default to newest year
  if (currentYear && sortedYears.includes(currentYear)) {
    selectYear.value = currentYear;
  } else if (sortedYears.length > 0) {
    selectYear.value = sortedYears[0];
  }
  
  // Populate Month
  selectMonth.innerHTML = '';
  const months = ["All Months", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    selectMonth.appendChild(opt);
  });
  if (currentMonth) {
    selectMonth.value = currentMonth;
  } else {
    selectMonth.value = "All Months";
  }
  
  // Populate Site
  selectSite.innerHTML = '';
  const optAllSites = document.createElement('option');
  optAllSites.value = "All Sites";
  optAllSites.textContent = "All Sites";
  selectSite.appendChild(optAllSites);
  
  const sortedSites = Array.from(sites).sort();
  sortedSites.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    selectSite.appendChild(opt);
  });
  if (currentSite && (currentSite === "All Sites" || sortedSites.includes(currentSite))) {
    selectSite.value = currentSite;
  } else {
    selectSite.value = "All Sites";
  }
}

// Compute dynamic last updated from data.csv (Month and Year)
function updateDynamicLastUpdated() {
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let maxYearVal = 0;
  let maxMonthIdx = -1;
  
  allCsvRows.forEach(r => {
    if (r.DataType === "Detail" && r.Year && r.Year !== "All Years" && r.Month && r.Month !== "All Months") {
      const y = parseInt(r.Year);
      const mIdx = monthOrder.indexOf(r.Month);
      if (y > maxYearVal) {
        maxYearVal = y;
        maxMonthIdx = mIdx;
      } else if (y === maxYearVal && mIdx > maxMonthIdx) {
        maxMonthIdx = mIdx;
      }
    }
  });

  if (maxYearVal > 0 && maxMonthIdx >= 0) {
    lastUpdatedTime.textContent = `${monthOrder[maxMonthIdx]} ${maxYearVal}`;
  } else {
    lastUpdatedTime.textContent = "Jun 2026";
  }
}

// Main Dashboard Calculation & UI Update
function updateDashboard() {
  const yearVal = selectYear.value;
  const monthVal = selectMonth.value;
  const siteVal = selectSite.value;
  
  const activeYear = parseInt(yearVal);
  const prevYear = activeYear - 1;
  
  // 1. Calculate Active Year actuals and plans
  const activeData = getAggregatedData(activeYear, monthVal, siteVal);
  // 2. Calculate Previous Year actuals
  const prevData = getAggregatedData(prevYear, monthVal, siteVal);
  
  // 3. Update KPI Cards UI
  const scope1Act = activeData.scope1.actual;
  const scope2Act = activeData.scope2.actual;
  const totalAct = scope1Act + scope2Act;
  
  kpiTotalVal.textContent = totalAct.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  kpiIntensityVal.textContent = activeData.carbonIntensity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  kpiS1Val.textContent = scope1Act.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  kpiS2Val.textContent = scope2Act.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  // Update trends for Scope 1 Card
  const prevScope1Act = prevData.scope1.actual;
  if (prevScope1Act > 0) {
    const s1DiffPercent = ((scope1Act - prevScope1Act) / prevScope1Act) * 100;
    const absDiff = Math.abs(Math.round(s1DiffPercent));
    const arrow = s1DiffPercent > 0 ? '↑' : '▼';
    const isBad = s1DiffPercent > 0;
    
    trendS1Badge.className = `kpi-card-trend-badge ${isBad ? 'red-badge' : 'green-badge'}`;
    trendS1Badge.style.display = 'inline-flex';
    trendS1Badge.innerHTML = `<span class="arrow">${arrow}</span> <span class="pct">${absDiff}%</span> <span class="label">compared to ${prevYear}</span>`;
  } else {
    trendS1Badge.style.display = 'none';
  }
  
  // Update trends for Scope 2 Card
  const prevScope2Act = prevData.scope2.actual;
  if (prevScope2Act > 0) {
    const s2DiffPercent = ((scope2Act - prevScope2Act) / prevScope2Act) * 100;
    const absDiff = Math.abs(Math.round(s2DiffPercent));
    const arrow = s2DiffPercent > 0 ? '↑' : '▼';
    const isBad = s2DiffPercent > 0;
    
    trendS2Badge.className = `kpi-card-trend-badge ${isBad ? 'red-badge' : 'green-badge'}`;
    trendS2Badge.style.display = 'inline-flex';
    trendS2Badge.innerHTML = `<span class="arrow">${arrow}</span> <span class="pct">${absDiff}%</span> <span class="label">compared to ${prevYear}</span>`;
  } else {
    trendS2Badge.style.display = 'none';
  }
  
  // 4. Render Charts
  renderComparisonChart(prevYear, activeYear, prevScope1Act + prevScope2Act, totalAct);
  renderBreakdownCharts(activeData);
}

// Core calculation engine to aggregate values dynamically based on filters
function getAggregatedData(year, monthFilter, siteFilter) {
  const result = {
    scope1: { actual: 0, plan: 0 },
    scope2: { actual: 0, plan: 0 },
    carbonIntensity: 0
  };
  
  let intensitySum = 0;
  let intensityCount = 0;
  
  allCsvRows.forEach(r => {
    // Filter matching conditions
    const matchYear = parseInt(r.Year) === year;
    const matchSite = (siteFilter === "All Sites") || (r.Site === siteFilter);
    const matchMonth = (monthFilter === "All Months") || (r.Month === monthFilter);
    
    if (!matchYear || !matchSite || !matchMonth) return;
    
    const val = getCleanRowValue(r);
    
    // Dynamic parsing based on DataType
    if (r.DataType === "Detail") {
      if (r.Scope === "Scope 1") {
        result.scope1.actual += val;
      } 
      else if (r.Scope === "Scope 2") {
        // Exclude solar related values from gross Scope 2 emissions
        if (r.ActivitySubCategory !== "Solar Value" && r.ActivitySubCategory !== "Solar Percent" && r.ActivitySubCategory !== "Share") {
          result.scope2.actual += val;
        }
      }
    } 
    else if (r.DataType === "Breakdown") {
      if (r.ActivitySubCategory === "Plan") {
        if (r.Scope === "Scope 1") result.scope1.plan += val;
        if (r.Scope === "Scope 2") result.scope2.plan += val;
      }
    } 
    else if (r.DataType === "KPI" && r.Scope === "OverviewKPI" && r.ActivitySubCategory === "carbonIntensity") {
      if (val > 0) {
        intensitySum += val;
        intensityCount++;
      }
    }
  });
  
  // Average non-zero carbon intensities
  result.carbonIntensity = intensityCount > 0 ? (intensitySum / intensityCount) : 0;
  
  return result;
}

// Helper to get monthly raw comparison data for both years
function getMonthlyComparisonData(year, siteFilter, displayMonths) {
  const monthlyValues = new Array(displayMonths.length).fill(0);
  
  allCsvRows.forEach(r => {
    const matchYear = parseInt(r.Year) === year;
    const matchSite = (siteFilter === "All Sites") || (r.Site === siteFilter);
    const mIdx = displayMonths.indexOf(r.Month);
    
    if (matchYear && matchSite && mIdx !== -1 && r.DataType === "Detail") {
      if (r.Scope === "Scope 1") {
        monthlyValues[mIdx] += getCleanRowValue(r);
      } else if (r.Scope === "Scope 2") {
        if (r.ActivitySubCategory !== "Solar Value" && r.ActivitySubCategory !== "Solar Percent" && r.ActivitySubCategory !== "Share") {
          monthlyValues[mIdx] += getCleanRowValue(r);
        }
      }
    }
  });
  return monthlyValues;
}

// Render Comparison Chart: Selected Year vs Previous Year (Scope 1+2 Actual)
function renderComparisonChart(prevYear, activeYear, prevVal, activeVal) {
  compPrevYear.textContent = prevYear;
  compActiveYear.textContent = activeYear;
  compTrendPrevYearLabel.textContent = prevYear;
  
  let diffPercent = 0;
  let chartSeries = [];
  let categories = [];
  let isDistributed = false;
  let colors = [];
  const annotationsPoints = [];
  let yAxisMax = undefined;
  let prevMonthly = [];
  
  if (currentComparisonView === "total") {
    if (prevVal > 0) {
      diffPercent = ((activeVal - prevVal) / prevVal) * 100;
    }
    
    chartSeries = [{
      name: 'Emissions',
      data: [Math.round(prevVal), Math.round(activeVal)]
    }];
    categories = [prevYear.toString(), activeYear.toString()];
    isDistributed = true;
    colors = ['#94A3B8', '#0B3A75'];
    
    const maxVal = Math.max(prevVal, activeVal);
    yAxisMax = maxVal > 0 ? Math.ceil(maxVal * 1.15) : 100;
  } else {
    // Monthly comparison view
    const siteVal = selectSite.value;
    const monthsList = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthFilter = selectMonth.value;
    
    // Default to Jan-Jun (first 6 months) for "All Months"
    let displayMonths = monthsList.slice(0, 6);
    
    const selectedIdx = monthsList.indexOf(monthFilter);
    if (selectedIdx !== -1) {
      displayMonths = monthsList.slice(0, selectedIdx + 1);
    }
    
    prevMonthly = getMonthlyComparisonData(prevYear, siteVal, displayMonths);
    const activeMonthly = getMonthlyComparisonData(activeYear, siteVal, displayMonths);
    
    // Calculate YTD cumulative percentage vs 2025 for the right circular badge
    let prevCumSum = prevMonthly.reduce((a, b) => a + b, 0);
    let activeCumSum = activeMonthly.reduce((a, b) => a + b, 0);
    if (prevCumSum > 0) {
      diffPercent = ((activeCumSum - prevCumSum) / prevCumSum) * 100;
    }
    
    chartSeries = [
      {
        name: prevYear.toString(),
        data: prevMonthly.map(v => Math.round(v))
      },
      {
        name: activeYear.toString(),
        data: activeMonthly.map(v => Math.round(v))
      }
    ];
    categories = displayMonths;
    isDistributed = false;
    colors = ['#94A3B8', '#0B3A75']; // Gray for prevYear, Dark Blue for activeYear
    
    // Calculate Y axis max and build annotations
    const allVals = [...prevMonthly, ...activeMonthly];
    const maxVal = allVals.length > 0 ? Math.max(...allVals) : 0;
    yAxisMax = maxVal > 0 ? Math.ceil(maxVal * 1.35) : 100; // Leave 35% space at the top for badges
    
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const val25 = prevMonthly[i];
      const val26 = activeMonthly[i];
      
      if (val25 > 0 || val26 > 0) {
        const barMax = Math.max(val25, val26);
        
        // Revert to individual monthly percentage for the bars
        const diff = val25 > 0 ? ((val26 - val25) / val25) * 100 : 0;
        const roundedDiff = Math.round(diff);
        const changeText = (roundedDiff >= 0 ? '+' : '') + roundedDiff + '%';
        
        let bgColor = '#FCE8E6'; // Light Red for positive (worse)
        let textColor = '#D22630';
        let borderColor = '#FCA5A5';
        
        if (roundedDiff < 0) {
          bgColor = '#E6F7F0'; // Light Green for negative (better)
          textColor = '#00A86B';
          borderColor = '#A7F3D0';
        } else if (roundedDiff === 0) {
          bgColor = '#F1F5F9'; // Light Gray for neutral
          textColor = '#64748B';
          borderColor = '#CBD5E1';
        }
        
        annotationsPoints.push({
          x: cat,
          y: barMax,
          marker: {
            size: 0,
            fillColor: 'transparent',
            strokeColor: 'transparent',
            strokeWidth: 0
          },
          label: {
            borderColor: borderColor,
            fillColor: bgColor,
            borderWidth: 1.5,
            borderRadius: 6,
            style: {
              color: textColor,
              fontSize: '13px',
              fontWeight: 800,
              fontFamily: 'Inter'
            },
            text: changeText,
            offsetY: -44 // Position cleanly above the bars and dataLabels
          }
        });
      }
    }
  }

  // Update circular badge UI using the correct YTD cumulative percentage
  const hasPrevData = currentComparisonView === "total" ? (prevVal > 0) : (prevMonthly && prevMonthly.reduce((a, b) => a + b, 0) > 0);
  if (hasPrevData) {
    const isBad = diffPercent > 0;
    compTrendCircle.className = `circular-trend-badge-large ${isBad ? 'red-badge' : 'green-badge'}`;
    compTrendCircle.innerHTML = `<span class="arrow">${diffPercent > 0 ? '↑' : '↓'}</span><span class="pct">${diffPercent > 0 ? '+' : ''}${Math.round(diffPercent)}%</span>`;
    compTrendPctLabel.textContent = `${diffPercent > 0 ? '+' : ''}${Math.round(diffPercent)}%`;
  } else {
    compTrendCircle.className = 'circular-trend-badge-large green-badge';
    compTrendCircle.innerHTML = `<span class="arrow">↓</span><span class="pct">0%</span>`;
    compTrendPctLabel.textContent = '0%';
  }

  const options = {
    series: chartSeries,
    chart: {
      type: 'bar',
      height: '100%',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
        animateGradually: { enabled: true, delay: 150 },
        dynamicAnimation: { enabled: true, speed: 350 }
      }
    },
    plotOptions: {
      bar: {
        distributed: isDistributed,
        columnWidth: isDistributed ? '45%' : '60%',
        borderRadius: 8,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: colors,
    dataLabels: {
      enabled: true,
      formatter: function(val, opts) {
        if (!val || val === 0) return '';
        
        if (currentComparisonView === "total") {
          // Total mode: show clean raw values for both bars
          return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        } else {
          // Grouped bar chart (monthly): series 0 is 2025, series 1 is 2026.
          // Hide labels for series 0 (2025) to avoid overlapping
          if (opts.seriesIndex === 0) {
            return '';
          }
          return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
      },
      offsetY: -22,
      style: {
        fontSize: '13px',
        fontFamily: 'Inter',
        fontWeight: 700,
        colors: ['#475569', '#0B3A75']
      }
    },
    annotations: {
      points: annotationsPoints
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      fontFamily: 'Inter',
      fontSize: '11px',
      fontWeight: 600,
      labels: {
        colors: '#64748B'
      },
      markers: {
        radius: 4,
        offsetX: -2
      },
      itemMargin: {
        horizontal: 10
      }
    },
    grid: {
      show: true,
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    xaxis: {
      categories: categories,
      labels: {
        style: {
          fontFamily: 'Inter',
          fontSize: '12px',
          fontWeight: 600,
          colors: '#64748B'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      show: true,
      max: yAxisMax,
      title: {
        text: 'tCO₂e',
        style: {
          color: '#94A3B8',
          fontSize: '11px',
          fontFamily: 'Inter',
          fontWeight: 600
        }
      },
      labels: {
        formatter: function(val) {
          return val.toLocaleString();
        },
        style: {
          fontFamily: 'Inter',
          fontSize: '11px',
          colors: '#94A3B8'
        }
      }
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: function(val) {
          return val.toLocaleString() + ' tCO2e';
        }
      }
    }
  };

  if (comparisonChart) {
    comparisonChart.updateOptions(options);
  } else {
    comparisonChart = new ApexCharts(document.getElementById('comparison-chart-div'), options);
    comparisonChart.render();
  }
}

// Render Scope 1 and Scope 2 Breakdown (Plan vs Actual)
function renderBreakdownCharts(activeData) {
  const s1Plan = activeData.scope1.plan;
  const s1Act = activeData.scope1.actual;
  const s2Plan = activeData.scope2.plan;
  const s2Act = activeData.scope2.actual;
  
  // Set values labels in UI
  breakdownS1Plan.textContent = s1Plan.toLocaleString(undefined, { maximumFractionDigits: 0 });
  breakdownS1Actual.textContent = s1Act.toLocaleString(undefined, { maximumFractionDigits: 0 });
  breakdownS2Plan.textContent = s2Plan.toLocaleString(undefined, { maximumFractionDigits: 0 });
  breakdownS2Actual.textContent = s2Act.toLocaleString(undefined, { maximumFractionDigits: 0 });
  
  // Scope 1 Circle badge vs Plan
  if (s1Plan > 0) {
    const s1Diff = ((s1Act - s1Plan) / s1Plan) * 100;
    const absDiff = Math.abs(Math.round(s1Diff));
    const isBad = s1Act > s1Plan;
    breakdownS1Circle.className = `circular-trend-badge-small ${isBad ? 'red-badge' : 'green-badge'}`;
    breakdownS1Circle.innerHTML = `<span class="arrow">${isBad ? '↑' : '↓'}</span><span class="pct">${isBad ? '+' : ''}${Math.round(s1Diff)}%</span>`;
  } else {
    breakdownS1Circle.className = 'circular-trend-badge-small green-badge';
    breakdownS1Circle.innerHTML = `<span class="arrow">↓</span><span class="pct">0%</span>`;
  }
  
  // Scope 2 Circle badge vs Plan
  if (s2Plan > 0) {
    const s2Diff = ((s2Act - s2Plan) / s2Plan) * 100;
    const absDiff = Math.abs(Math.round(s2Diff));
    const isBad = s2Act > s2Plan;
    breakdownS2Circle.className = `circular-trend-badge-small ${isBad ? 'red-badge' : 'green-badge'}`;
    breakdownS2Circle.innerHTML = `<span class="arrow">${isBad ? '↑' : '↓'}</span><span class="pct">${isBad ? '+' : ''}${Math.round(s2Diff)}%</span>`;
  } else {
    breakdownS2Circle.className = 'circular-trend-badge-small green-badge';
    breakdownS2Circle.innerHTML = `<span class="arrow">↓</span><span class="pct">0%</span>`;
  }

  // Apex options for Scope 1 Breakdown
  const s1Options = getBreakdownChartOptions('Scope 1', s1Plan, s1Act, ['#DBEAFE', '#2563EB']);
  if (s1BreakdownChart) {
    s1BreakdownChart.updateOptions(s1Options);
  } else {
    s1BreakdownChart = new ApexCharts(document.getElementById('s1-breakdown-chart-div'), s1Options);
    s1BreakdownChart.render();
  }

  // Apex options for Scope 2 Breakdown
  const s2Options = getBreakdownChartOptions('Scope 2', s2Plan, s2Act, ['#D1FAE5', '#059669']);
  if (s2BreakdownChart) {
    s2BreakdownChart.updateOptions(s2Options);
  } else {
    s2BreakdownChart = new ApexCharts(document.getElementById('s2-breakdown-chart-div'), s2Options);
    s2BreakdownChart.render();
  }
}

// Generate generic breakdown chart options
function getBreakdownChartOptions(name, planVal, actVal, colors) {
  return {
    series: [{
      name: 'Emissions',
      data: [Math.round(planVal), Math.round(actVal)]
    }],
    chart: {
      type: 'bar',
      height: '100%',
      toolbar: { show: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    plotOptions: {
      bar: {
        distributed: true,
        columnWidth: '55%',
        borderRadius: 5,
        dataLabels: {
          position: 'top'
        }
      }
    },
    colors: colors,
    dataLabels: {
      enabled: false,
      formatter: function(val) {
        return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
      },
      offsetY: -20,
      style: {
        fontSize: '11px',
        fontFamily: 'Inter',
        fontWeight: 700,
        colors: ['#475569', colors[1]]
      }
    },
    legend: { show: false },
    grid: {
      show: true,
      borderColor: '#F1F5F9',
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } }
    },
    annotations: {
      yaxis: planVal > 0 ? [{
        y: Math.round(planVal),
        borderColor: '#EF4444',
        strokeDashArray: 4,
        borderWidth: 2,
        label: {
          show: false
        }
      }] : []
    },
    xaxis: {
      categories: ['Plan', 'Actual'],
      labels: {
        style: {
          fontFamily: 'Inter',
          fontSize: '11px',
          fontWeight: 600,
          colors: '#64748B'
        }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      show: false
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: function(val) {
          return val.toLocaleString() + ' tCO2e';
        }
      }
    }
  };
}
