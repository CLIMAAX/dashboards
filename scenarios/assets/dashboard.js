// Variable full names and units
const variableFullNames = {
    'tas': 'Mean Temperature',
    'tasmin': 'Minimum Temperature',
    'TNn': 'Minimum of Minimum Temperature',
    'fd': 'Frost Days',
    'hdd': 'Heating Degree Days',
    'tasmax': 'Maximum Temperature',
    'TXx': 'Maximum of Maximum Temperature',
    'tx35': 'Days with Temperature > 35 \u00B0C',  // Degree Celsius symbol
    'TX35bc': 'Days with Temperature > 35 \u00B0C (Bias Corrected)',  // Degree Celsius symbol
    'tx40': 'Days with Temperature > 40 \u00B0C',  // Degree Celsius symbol
    'TX40bc': 'Days with Temperature > 40 \u00B0C (Bias Corrected)',  // Degree Celsius symbol
    'cdd': 'Cooling Degree Days',
    'pr': 'Total Precipitation',
    'Rx1day': 'Maximum 1-Day Precipitation',
    'Rx5day': 'Maximum 5-Day Precipitation',
    'ds': 'Consecutive Dry Days',
    'spi6': 'Standardized Precipitation Index (6 months)',
    'prsn': 'Total Snowfall',
    'sfcWind': 'Surface Wind Speed'
};

const variableUnits = {
    'tas': '&#8451;',
    'tasmin': '&#8451;',
    'tasmax': '&#8451;',
    'TNn': '&#8451;',
    'TXx': '&#8451;',
    'pr': '%',
    'Rx1day': '%',
    'Rx5day': '%',
    'spi6': '%',
    'sfcWind': '%',
    'prsn': 'mm/day',
    'cdd': 'Degree Days',
    'hdd': 'Degree Days'
}
    
// Variables for dropdown options
const atmosVariables = [
    'tas', 'tasmin', 'TNn', 'fd', 'hdd',
    'tasmax', 'TXx', 'tx35', 'TX35bc', 'tx40', 'TX40bc', 'cdd',
    'pr', 'Rx1day', 'Rx5day', 'ds', 'spi6',
    'prsn', 'sfcWind'
];
    
// Scenarios and colors
const scenariosAndColors = {
    'CMIP6': {
    'scenarios': ['ssp126', 'ssp245', 'ssp370', 'ssp585'],
    'colors': {
        'ssp126': '#402575',  // Deep blue
        'ssp245': '#91ADD3',  // Light blue
        'ssp370': '#F19D6F',  // Orange
        'ssp585': '#E64139'   // Red
    }
    },
    'CORDEX': {
    'scenarios': ['rcp26', 'rcp45', 'rcp85'],
    'colors': {
        'rcp26': '#402575',  // Deep blue
        'rcp45': '#91ADD3',  // Light blue
        'rcp85': '#E64139'   // Red
    }
    }
};

// Initialize the widget on page load
document.addEventListener("DOMContentLoaded", function () {
    // Populate variable dropdown
    const variableSelect = document.getElementById('variable');
    atmosVariables.forEach(function(varCode) {
        const option = document.createElement('option');
        option.value = varCode;
        option.text = variableFullNames[varCode] || varCode;
        variableSelect.add(option);
    });

    // Update plot on user interaction
    document.getElementById('region').addEventListener('change', updatePlot);
    document.getElementById('dataset').addEventListener('change', updatePlot);
    document.getElementById('variable').addEventListener('change', updatePlot);
    document.getElementById('time_filter').addEventListener('change', updatePlot);
    document.getElementById('timeframe').addEventListener('change', updatePlot);
    // Initialize plot
    updatePlot();
});

function updatePlot() {
    // Get user selections
    const region = document.getElementById('region').value;
    const dataset = document.getElementById('dataset').value;
    const variable = document.getElementById('variable').value;
    const timeFilter = document.getElementById('time_filter').value;
    const timeframe = document.getElementById('timeframe').value;

    const variableFullName = variableFullNames[variable] || variable;
    const unit = variableUnits[variable] || 'days';

    // File path to CSV data
    const dataFilePath = `data/${region}_${dataset}_preIndustrial_landmask%3Dtrue.csv`;
    // Load data with D3
    d3.csv(dataFilePath).then(function(data) {
        // Filter and process the data
        const filteredData = data.filter(function(d) {
        return (
            d.variable === variable &&
            d.date === timeframe &&
            d.season === timeFilter
        );
        });

    
        if (filteredData.length === 0) {
        // Display message if data is not available
        displayNoDataMessage(Plotly, variableFullName, dataset, region, timeFilter, timeframe);
        return;
        }
    
        // Process data for plotting
        const plotData = processData(filteredData, dataset);
    
        // Render the plot
        renderPlot(Plotly, plotData, variableFullName, unit, dataset, region, timeFilter, timeframe);
    }).catch(function(error) {
        console.error('Error loading data:', error);
        displayNoDataMessage(Plotly, variableFullName, dataset, region, timeFilter, timeframe);
    });
}

function processData(data, dataset) {
    const scenarios = scenariosAndColors[dataset].scenarios;
    const colors = scenariosAndColors[dataset].colors;

    // Extract SSP impacts from 'mmm' data
    const sspImpacts = {};
    data.forEach(function(d) {
    if (d.model === 'mmm') {
        sspImpacts[d.scenario] = parseFloat(d.value);
    }
    });

    const plotData = [];
    data.forEach(function(d) {
    const impact = parseFloat(d.value);
    const sspImpact = sspImpacts[d.scenario];
    const color = colors[d.scenario] || 'black';

    plotData.push({
        model: d.model,
        ssp: d.scenario,
        impact: impact,
        sspImpact: sspImpact,
        color: color
    });
    });

    return plotData;
}

function renderPlot(Plotly, data, variableFullName, unit, dataset, region, timeFilter, timeframe) {
    const traces = [];
    const yMapping = {'Model': 0, 'SSP': 1, 'SSP Extension': 2};

    // Plot lines for each model and SSP
    data.forEach(function(entry) {
    const ssp = entry.ssp;
    const color = entry.color;
    const modelName = entry.model;

    if (modelName === 'mmm') {
        const xVals = [entry.sspImpact, entry.sspImpact];
        const yVals = [yMapping['SSP'], yMapping['SSP Extension']];
        traces.push({
        x: xVals,
        y: yVals,
        mode: 'lines',
        line: {color: color, width: 2},
        hoverinfo: 'text',
        text: `Model: ${modelName}<br>SSP: ${ssp}<br>Impact: ${entry.sspImpact.toFixed(2)} ${unit}`,
        showlegend: false
        });
        // Skip to the next iteration
        return;
    }

    const xVals = [entry.impact, entry.sspImpact];
    const yVals = [yMapping['Model'], yMapping['SSP']];
    traces.push({
        x: xVals,
        y: yVals,
        mode: 'lines',
        line: {color: color, width: 2},
        hoverinfo: 'text',
        text: `Model: ${modelName}<br>SSP: ${ssp}<br>Change: ${entry.impact.toFixed(2)} ${unit}`,
        showlegend: false
    });
    });

    // Calculate the x_range based on min and max impact values
    const impacts = data.map(entry => entry.impact);  // Extract impact values
    const x_min = Math.min(...impacts);               // Get minimum impact
    const x_max = Math.max(...impacts);               // Get maximum impact
    const range_extension = 0.05 * (x_max - x_min);   // Extend the range by 5%
    const x_range = [x_min - range_extension, x_max + range_extension];  // Define the x-axis range


    // Set x-axis properties
    const xAxisTitle = `Change in ${variableFullName} [${unit}]`;
    const scenario_label = dataset === 'CMIP6' ? 'SSP' : 'RCP';

    // Layout configuration
    const layout = {
        height: 600,
        margin: {l: 50, r: 50, t: 50, b: 50},
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        title: {text: `Projected changes ${dataset} in ${region} for ${variableFullName}<br>during ${timeFilter} between ${timeframe}-${+timeframe + 19}`},
        xaxis: {
            title: {text: xAxisTitle},
            range: x_range,
            showgrid: false,
            zeroline: false,
            ticks: 'outside',
            ticklen: 3,
            tickwidth: 1,
            tickcolor: 'black',
            showline: true,
            linecolor: 'black',
            linewidth: 1
        },
        yaxis: {
            tickmode: 'array',
            tickvals: [yMapping['Model'], yMapping['SSP'], yMapping['SSP Extension']],
            ticktext: ['Model', scenario_label, ''],
            showgrid: false,
            zeroline: false
        },
        legend: {
            orientation: 'h',
            y: -0.2,
            x: 0.5,
            xanchor: 'center',
            yanchor: 'top'
        },
        hovermode: 'closest'  // Set hovermode to 'closest'
    };

    // Add traces for the SSP legends
    const scenarios = scenariosAndColors[dataset].scenarios;
    const colors = scenariosAndColors[dataset].colors;
    scenarios.forEach(function(ssp) {
    traces.push({
        x: [null],
        y: [null],
        mode: 'lines',
        line: {color: colors[ssp], width: 4},
        name: ssp
    });
    });

    // Render the plot
    Plotly.newPlot('plotDiv', traces, layout, {
        responsive: true,
    });
}

function displayNoDataMessage(Plotly, variableFullName, dataset, region, timeFilter, timeframe) {
    const layout = {
        height: 500,
        margin: {l: 20, r: 20, t: 50, b: 50},
        plot_bgcolor: 'white',
        paper_bgcolor: 'white',
        title: `Projected changes ${dataset} in ${region} for ${variableFullName}<br>during ${timeFilter} between ${timeframe}-${+timeframe + 19}`
    };

    const annotation = {
        text: "Data not available, try another selection",
        x: 0.5,
        y: 0.5,
        showarrow: false,
        font: {size: 20},
        xref: 'paper',
        yref: 'paper'
    };

    Plotly.newPlot('plotDiv', [], layout).then(function() {
        Plotly.relayout('plotDiv', {annotations: [annotation]});
    });
}