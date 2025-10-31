//require.config({
//    paths: {
//        "Plotly": "https://cdn.plot.ly/plotly-3.0.1.min"
//    }
//});

const GCM_COLORS = {
    'CNRM-CERFACS-CNRM-CM5': 'green',
    'ICHEC-EC-EARTH': 'red',
    'IPSL-IPSL-CM5A-MR': 'orange',
    'MOHC-HadGEM2-ES': 'blue',
    'MPI-M-MPI-ESM-LR': 'purple',
    'NCC-NorESM1-M': 'black'
};

const RCM_SYMBOLS = {
    'CLMcom-CCLM4-8-17': 'circle',
    'CNRM-ALADIN63': 'triangle-left',
    'KNMI-RACMO22E': 'x',
    'SMHI-RCA4': 'square',
    'DMI-HIRHAM5': 'cross',
    'GERICS-REMO2015': 'diamond',
    'IPSL-WRF381P': 'triangle-up',
    'MPI-CSC-REMO2009': 'triangle-down'
};


// Map configuration
const DEFAULT_MAP_VAR = "tas";
const DEFAULT_OPERATOR = "mean";
const DEFAULT_REFERENCE = "era5";

const MAP_HOVER_TEMPLATE = (
    "<b>%{location}</b><br>" +
    "%{text.NUTS_NAME}<br>" +
    "%{text.NAME_LATN}"
);

const OPERATORS = {
    "mean": (xs) => (xs.reduce((a, b) => a + b, 0.) / xs.length),
    "maximum": (xs) => Math.max(...xs),
    "median": (xs) => {
        const sorted = xs.toSorted((a, b) => a - b);
        if (sorted.length % 2 === 1) {
            return sorted[(sorted.length - 1) / 2];
        } else {
            return 0.5 * (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]);
        }
    },
    "minimum": (xs) => Math.min(...xs),
    "smallest": (xs) => closestToZero(xs)[0]
};

const VARIABLES = ["tas", "pr"];
const REFERENCES = ["eobs", "era5"];

const COLORAXIS = {
    "tas": {
        colorscale: [
            [0.0, 'rgb(5,48,97)'],
            [0.1, 'rgb(33,102,172)'],
            [0.2, 'rgb(67,147,195)'],
            [0.3, 'rgb(146,197,222)'],
            [0.4, 'rgb(209,229,240)'],
            [0.5, 'rgb(247,247,247)'],
            [0.6, 'rgb(253,219,199)'],
            [0.7, 'rgb(244,165,130)'],
            [0.8, 'rgb(214,96,77)'],
            [0.9, 'rgb(178,24,43)'],
            [1.0, 'rgb(103,0,31)'],
        ],
        cmin: -3.5,
        cmid: 0.0,
        cmax: 3.5
    },
    "pr": {
        colorscale: [
            [0.0, 'rgb(84,48,5)'],
            [0.1, 'rgb(140,81,10)'],
            [0.2, 'rgb(191,129,45)'],
            [0.3, 'rgb(223,194,125)'],
            [0.4, 'rgb(246,232,195)'],
            [0.5, 'rgb(245,245,245)'],
            [0.6, 'rgb(199,234,229)'],
            [0.7, 'rgb(128,205,193)'],
            [0.8, 'rgb(53,151,143)'],
            [0.9, 'rgb(1,102,94)'],
            [1.0, 'rgb(0,60,48)'],
        ],
        cmin: -80.0,
        cmid: 0.0,
        cmax: 80.0
    }
};


// Bias scatter plot configuration
const BIAS_VAR_X = "pr";
const BIAS_VAR_Y = "tas";

const BIAS_GUARANTEE_XRANGE = [-10, 10];
const BIAS_GUARANTEE_YRANGE = [-0.25, 0.25];

const BIAS_HOVER_TEMPLATE = (
    "<b>GCM:</b> %{text.gcm}<br>" +
    "<b>RCM:</b> %{text.rcm}<br>" +
    "<b>ENS:</b> %{text.ens}<br>" +
    "<b>Temperature bias:</b> %{y:.2f} °C<br>" +
    "<b>Precipitation bias:</b> %{x:.2f} %"
);


// Utilities
const DOM = {
    getNode: function getNode(id) {
        const node = document.getElementById("dashboard-" + id);
        if (node == null) {
            throw new Error("Element " + id + " not found");
        }
        return node;
    },
    setAttrs: function (node, attrs) {
        if (node != null && attrs != null) {
            for (const key in attrs) {
                const value = attrs[key];
                if (value != null) {
                    node.setAttribute(key, value.toString());
                }
            }
        }
    },
    newNode: function (tag, attrs, children) {
        const node = document.createElement(tag);
        DOM.setAttrs(node, attrs);
        if (children != null) {
            for (let child of children) {
                if (typeof child == "string") {
                    child = document.createTextNode(child);
                }
                node.appendChild(child);
            }
        }
        return node;
    },
    scrollTo: function (id) {
        DOM.getNode(id).scrollIntoView({behavior: "smooth"});
    }
};

function capitalizeFirst(s) {
    return s.charAt(0).toUpperCase() + s.substring(1);
}

function closestToZero(xs) {
    if (xs.length == 0) {
        return NaN;
    }
    let idx = 0;
    xs.forEach((x, i) => {
        if (Math.abs(x) < Math.abs(xs[idx])) {
            idx = i;
        }
    });
    return [xs[idx], idx];
}

async function runBiasDashboard() {

    // Cached data retrieval
    const _CACHE = new Map();
    async function fetchData(filename) {
        if (!_CACHE.has(filename)) {
            const response = await fetch(`data/${filename}`);
            _CACHE.set(filename, await response.json());
        }
        return _CACHE.get(filename);
    }

    function getBiasData(ref) {
        return fetchData(`bias-${ref}.json`);
    }

    const CORDEX = await fetchData("eurocordex.geojson");
    const NUTS = await fetchData("regions.geojson");
    const META = await fetchData("metadata.json");
    const MODELS = META.models;
    const ATTRS = META.attrs;

    function getNutsFeature(nuts_id) {
        for (const feature of NUTS.features) {
            if (feature.id === nuts_id) {
                return feature;
            }
        }
        throw new Error("Not found: " + nuts_id);
    }

    function getVarName(v) {
        return capitalizeFirst(ATTRS[v].name);
    }

    function getBiasLabel(v) {
        return getVarName(v) + " bias";
    }

    function getBiasUnit(v) {
        return ATTRS[v].bias.unit;
    }

    function getBiasTickSuffix(v) {
        return " " + getBiasUnit(v);
    }

    function getProjUnit(v) {
        return ATTRS[v].proj.unit;
    }

    /*function getProjTickSuffix(v) {
        return " " + getProjUnit(v);
    }*/

    /*function getProjLabel(v) {
        return getVarName(v) + " projection";
    }*/

    // Application state: keep all information on selected region
    // or null if no region is selected
    let selection = null;

    async function selectData(nutsID) {
        // Clear selection, return dummy promise to start .then chain
        if (nutsID == null) {
            selection = null;
            return;
        }
        const nuts = getNutsFeature(nutsID);
        // Extract data based on selection
        const reference = DOM.getNode("reference").value;
        const biasData = await getBiasData(reference);
        const bias = MODELS.map((model, i) => {
            const out = {
                model: model,
                reference: reference,
                //rank: biasData[nutsID].rank[i]
            };
            for (const variable of VARIABLES) {
                out[variable] = {
                    value: biasData[nutsID][variable][i],
                    name: ATTRS[variable].name,
                    unit: ATTRS[variable].bias.unit,
                    period: ATTRS[variable].bias.period,
                };
            }
            return out;
        });
        // Extract the selected data from the database
        selection = {
            NUTS_ID: nutsID,
            geometry: nuts.geometry,
            ...nuts.properties,
            bias: bias
        };
        // Allow direct links to specific regions
        window.location.hash = nutsID;
    }

    async function refreshData() {
        if (selection != null) {
            return selectData(selection.NUTS_ID);
        }
    }

    // Map functions

   function initializeMap() {
        // CORDEX domain boundary
        const traceCordex = {
            type: "choropleth",
            geojson: CORDEX,
            locations: ["EURO"],
            hoverinfo: "skip",
            z: CORDEX.features.map(() => 0.5),
            colorscale: [[0, "rgba(0,0,0,0.1)"], [1, "rgba(0,0,0,0.1)"]],
            showscale: false,
            marker: {
                line: {width: 1, color: "black"}
            }
        };
        // Add NUTS domain boundaries without data first
        const traceNuts = {
            name: "",
            type: "choropleth",
            geojson: NUTS,
            locationmode: "geojson-id",
            locations: NUTS.features.map(_ => _.id),
            z: NUTS.features.map(_ => 0.),
            coloraxis: "coloraxis",
            marker: {line: {width: 1, color: "black"}},
            text: NUTS.features.map(_ => _.properties),
            hovertemplate: MAP_HOVER_TEMPLATE
        };
        const traceSelected = {
            name: "",
            type: "choropleth",
            geojson: NUTS,
            locationmode: "geojson-id",
            locations: [],
            hoverinfo: "skip",
            z: NUTS.features.map(_ => 0.),
            colorscale: [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0)"]],
            showscale: false,
            marker: {line: {width: 3, color: "black"}},
        };
        const layout = {
            geo: {
                projection: {type: "equirectangular", rotation: {lat: 50, lon: 15}},
                showcoastlines: false,
                showocean: true,
                oceancolor: "#EEE",
                resolution: 50,
                showframe: false,
                lonaxis: {range: [-20, 50]},
                lataxis: {range: [35, 70]}
            },
            margin: {l: 0, r: 0, t: 20, b: 20},
            coloraxis: {showscale: false}
        };
        const config = {
            responsive: true,
            modeBarButtonsToRemove: ["select2d", "lasso2d"]
        };
        return Plotly.newPlot(
            DOM.getNode("map"),
            [traceCordex, traceNuts, traceSelected],
            layout,
            config
        );
    }

    function updateMapSelection() {
        const data = {
            "locations": [(selection == null) ? [] : [selection.NUTS_ID]]
        };
        return Plotly.restyle(DOM.getNode("map"), data, 2);
    }

    // Compute all values for the choropleth map based on the selected
    // variable, aggregation operator and models
    function aggregateForMap(xs) {
        const select = DOM.getNode("operator");
        const values = [];
        for (let i = 0; i < modelSelectionBoxes.length; i++) {
            if (modelSelectionBoxes[i].checked && xs[i] != null && !isNaN(xs[i])) {
                values.push(xs[i]);
            }
        }
        return values.length == 0 ? NaN : OPERATORS[select.value](values);
    }

    async function updateMapValues() {
        const mapDiv = DOM.getNode("map");
        const selectedVar = DOM.getNode("variable").value;
        const bias = await getBiasData(DOM.getNode("reference").value);
        const data = {
            z: [mapDiv.data[1].geojson.features.map(
                (feature) => aggregateForMap(bias[feature.id][selectedVar])
            )],
            hovertemplate: (
                MAP_HOVER_TEMPLATE + "<br>" +
                "<b>Bias:</b> %{z:.2f} " + getBiasUnit(selectedVar)
            )
        };
        const layout = {
            coloraxis: {
                showscale: true,
                colorscale: COLORAXIS[selectedVar].colorscale,
                colorbar: {
                    bgcolor: "rgba(255,255,255,0.8)",
                    orientation: "v",
                    x: 0.9,
                    len: 0.8,
                    title: {
                        text: getBiasLabel(selectedVar),
                        side: "right"
                    },
                    ticksuffix: getBiasTickSuffix(selectedVar)
                },
            },
        };
        // User-configured autoscaling of colorbar range
        const autoscale = DOM.getNode("autoscale").checked;
        if (autoscale) {
            layout.coloraxis.cauto = true;
            layout.coloraxis.cmid = COLORAXIS[selectedVar].cmid;
        } else {
            layout.coloraxis.cmin = COLORAXIS[selectedVar].cmin;
            layout.coloraxis.cmax = COLORAXIS[selectedVar].cmax;
        }
        return Plotly.update(mapDiv, data, layout, 1);
    }

    // Details functions

    function initializeDetails() {
        const promises = [];
        // Universal config
        const config = {
            responsive: true,
            modeBarButtonsToRemove: ["select2d", "lasso2d"]
        };
        // Bias plot
        const dataBias = MODELS.map((model) => ({
            type: "scatter",
            x: [0],
            y: [0],
            mode: "markers",
            name: "",
            text: [model],
            hovertemplate: BIAS_HOVER_TEMPLATE,
            marker: {
                size: 12,
                color: GCM_COLORS[model.gcm],
                symbol: RCM_SYMBOLS[model.rcm]
            },
        }));
        const layoutBias = {
            height: 600,
            margin: {l: 100, r: 0},
            xaxis: {
                title: {text: getBiasLabel(BIAS_VAR_X)},
                ticksuffix: getBiasTickSuffix(BIAS_VAR_X),
                zeroline: true,
                zerolinecolor: "black",
                zerolinewidth: 2.0,
                autorange: true,
                autorangeoptions: {include: BIAS_GUARANTEE_XRANGE}
            },
            yaxis: {
                title: {text: getBiasLabel(BIAS_VAR_Y)},
                ticksuffix: getBiasTickSuffix(BIAS_VAR_Y),
                zeroline: true,
                zerolinecolor: "black",
                zerolinewidth: 2.0,
                autorange: true,
                autorangeoptions: {include: BIAS_GUARANTEE_YRANGE}
            },
            showlegend: false
        };
        promises.push(
            Plotly.newPlot(DOM.getNode("bias"), dataBias, layoutBias, config)
        );
        /* Placeholders for uncertainty plots
        for (const variable of VARIABLES) {
            const dataProj = MODELS.map(model => ({
                type: "scatter",
                x: [0],
                y: [0],
                name: "",
                text: `${model.gcm} ${model.rcm}`,
                marker: {size: 8, symbol: RCM_SYMBOLS[model.rcm]},
                line: {width: 1.5, color: GCM_COLORS[model.gcm]},
            }));
            const layoutProj = {
                height: 450,
                margin: {l: 100, r: 0},
                showlegend: false,
                yaxis: {
                    //title: {text: getProjLabel(variable)},
                    ticksuffix: getProjTickSuffix(variable)
                }
            };
            promises.push(
                Plotly.newPlot(DOM.getNode(`uncertainty-${variable}`), dataProj, layoutProj, config)
            );
        }
        */
        return Promise.all(promises);
    }

    function updateDetails() {
        if (selection == null) {
            DOM.getNode("title").textContent = "no selection";
            DOM.getNode("latin-name").textContent = "n/a";
            DOM.getNode("nuts-id").textContent = "n/a";
            //DOM.getNode("details-rec-title").textContent = "Model recommendation";
            //DOM.getNode("details-rec-text").textContent = "no selection";
            return;
        }
        const promises = [];
        const nutsID = selection.NUTS_ID;
        const reference = DOM.getNode("reference").value;
        const visible = selection.bias.map((model, i) => modelSelectionBoxes[i].checked);
        // Update bias scatter plot
        const dataBias = {
            x: selection.bias.map(model => [model[BIAS_VAR_X].value]),
            y: selection.bias.map(model => [model[BIAS_VAR_Y].value]),
            visible: visible,
        };
        // Dynamic description/interpretation of bias plot
        //let recModel = null;
        //selection.bias.forEach((model, i) => {
        //    if (visible[i] && (recModel == null || model.rank < recModel.rank)) {
        //        recModel = model;
        //    }
        //});
        //if (recModel == null) {
        //    DOM.getNode("details-rec-title").textContent = "Model recommendation";
        //    DOM.getNode("details-rec-text").textContent = "no data available";
        //} else {
        //    DOM.getNode("details-rec-title").textContent = `Model recommendation based on bias against ${reference.toUpperCase()}`;
        //    DOM.getNode("details-rec-text").textContent = `${recModel.model.gcm} ${recModel.model.rcm} ${recModel.model.ens}`;
        //}
        const layoutBias = {
            title: {text: `Model bias against ${reference.toUpperCase()}: ${selection.NUTS_NAME} (${nutsID})`}
        };
        promises.push(
            Plotly.update(DOM.getNode("bias"), dataBias, layoutBias)
        );
        // Generate text content
        DOM.getNode("title").textContent = selection.NUTS_NAME;
        DOM.getNode("latin-name").textContent = selection.NAME_LATN;
        DOM.getNode("nuts-id").textContent = selection.NUTS_ID;
        /* Update projection plumes
        for (const variable of VARIABLES) {
            const dataProj = {
                x: selection.data.map(model => model.proj.time),
                y: selection.data.map(model => model.proj[variable]),
                visible: visible
            };
            const layoutProj = {
                title: {text: `${getProjLabel(variable)}: ${selection.NUTS_NAME} (${nutsID})`}
            };
            promises.push(
                Plotly.update(DOM.getNode(`uncertainty-${variable}`), dataProj, layoutProj)
            );
        }
        */
        // Offer selected data for download
        const exportButton = DOM.getNode("export-json");
        exportButton.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selection)));
        exportButton.setAttribute("download", `CORDEX-${nutsID}.json`)
        // Update plots
        return Promise.all(promises);
    }

    // GUI functions

    function generateVariableSelection(node) {
        for (let v of VARIABLES) {
            const label = capitalizeFirst(ATTRS[v].name);
            node.appendChild(DOM.newNode("option", {"value": v}, [`${label} bias`]));
        }
        node.value = DEFAULT_MAP_VAR;
    }

    function generateOperatorSelection(node) {
        for (let op in OPERATORS) {
            const label = capitalizeFirst(op);
            node.appendChild(DOM.newNode("option", {"value": op}, [`${label} of models`]));
        }
        node.value = DEFAULT_OPERATOR;
    }

    function generateReferenceSelection(node) {
        for (let ref of REFERENCES) {
            const label = ref.toUpperCase();
            node.appendChild(DOM.newNode("option", {"value": ref}, [`Bias against ${label}`]));
        }
        node.value = DEFAULT_REFERENCE;
    }

    // Initialisation: generate model selection dialogue with all
    // models selected by default
    const modelSelectionBoxes = [];
    function generateModelSelection() {
        const modelSelection = DOM.getNode("models");
        let fieldset = null;
        for (let i = 0; i < MODELS.length; i++) {
            const model = MODELS[i];
            if (i == 0 || MODELS[i-1].gcm != model.gcm) {
                fieldset = DOM.newNode("fieldset", null, [
                    DOM.newNode("legend", {style: `color: ${GCM_COLORS[model.gcm]}`}, [model.gcm])
                ]);
                modelSelection.appendChild(fieldset);
            }
            const input = DOM.newNode("input", {"type": "checkbox", "checked": "checked"});
            input.addEventListener("change", () => {
                updateMapValues();
                updateDetails();
            });
            fieldset.appendChild(DOM.newNode("label", null, [
                input, " ", model.rcm, DOM.newNode("span", {"class": "ens-name"}, " (" + model.ens + ")")
            ]));
            modelSelectionBoxes[i] = input;
        }
        // Trigger window resize to adapt with of plotly plot
        window.dispatchEvent(new Event("resize"));
    }

    function updateSearch() {
        const resultsNode = DOM.getNode("search-results");
        let query = DOM.getNode("search-input").value.trim().toLowerCase();
        // Match anywhere in string by default
        let match = (x) => x.toLowerCase().includes(query);
        // Match only at the start for queries starting with ^
        if (query.startsWith("^")) {
            query = query.substring(1);
            match = (x) => x.toLowerCase().startsWith(query);
        }
        // Display all regions by default, apply filter as user queries
        const results = NUTS.features.filter((f) => (
            query.length === 0 || match(f.id) || match(f.properties.NUTS_NAME) || match(f.properties.NAME_LATN) 
        ));
        // Generate matches or inform the user that there was no match
        if (results.length > 0) {
            resultsNode.replaceChildren(...results.map((f) => {
                const link = DOM.newNode("a", {}, [
                    DOM.newNode("span", {}, [f.properties.NUTS_NAME]),
                    DOM.newNode("span", {}, [f.id]),
                ]);
                // In contrast to click, mousedown triggers before the blur
                // event of the input field that takes away the menu
                link.addEventListener("mousedown", () => selectAndUpdate(f.id));
                return link;
            }));
        } else {
            resultsNode.replaceChildren(DOM.newNode("span", {}, "no matches"));
        }
    }

    async function selectAndUpdate(nutsID) {
        await selectData(nutsID);
        updateMapSelection();
        updateDetails();
        DOM.scrollTo("details-anchor");
    }

    // Populate GUI
    generateVariableSelection(DOM.getNode("variable"));
    generateOperatorSelection(DOM.getNode("operator"));
    generateReferenceSelection(DOM.getNode("reference"));
    generateModelSelection();
    // Create empty map and details plots
    await Promise.all([
        initializeMap(),
        initializeDetails()
    ]);
    // Now everything is ready to fill values into the map
    await updateMapValues();
    // Directly load and show details for a region (if given)
    const loadFromHash = window.location.hash.substring(1);
    if (loadFromHash.length > 0) {
        await selectData(loadFromHash);
        //DOM.scrollTo("details-anchor");
    }
    updateDetails();
    updateMapSelection();
    updateSearch();
    // Map controls
    DOM.getNode("map").on("plotly_click", (ed) => {
        // This seems to stop the details being opened when
        // moving the map while the cursor is over a region:
        if (!ed.event.defaultPrevented) {
            selectAndUpdate(ed.points[0].location);
        }
    });
    DOM.getNode("variable").addEventListener("change", updateMapValues);
    DOM.getNode("operator").addEventListener("change", updateMapValues);
    DOM.getNode("reference").addEventListener("change", async () => {
        updateMapValues();
        // The reference selector of the map also controls the reference
        // for the bias section in the details
        await refreshData();
        updateDetails();
    });
    DOM.getNode("autoscale").addEventListener("change", updateMapValues);
    // Search box
    DOM.getNode("search-input").addEventListener("focus", () => {
        DOM.getNode("search-dropdown").style.display = "block";
        updateSearch();
    });
    DOM.getNode("search-input").addEventListener("input", updateSearch);
    DOM.getNode("search-input").addEventListener("blur", (e) => {
        DOM.getNode("search-dropdown").style.display = "none";
    });
}

document.addEventListener("DOMContentLoaded", runBiasDashboard);
