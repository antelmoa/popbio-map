/**
 * Created by Ioannis on 10/03/2015.
 * A library that will gradually contain all the basic functions and objects for the VectorBase PopBio map
 * As my knowledge of javascript gets better I will try to optimize and include as much functionality in this
 * library as possible.
 */

function loadSolr(parameters) {

    //ToDo: Add AJAX error and timeout handling
    //FixMe: Missing values from species_category field messing up pie charts.
    // http://vb-dev.bio.ic.ac.uk:7997/solr/vb_popbio/select?q=*:*&fq=bundle_name:Sample&fq=has_geodata:true&wt=json&indent=true&stats=true&stats.field=species_category&rows=0
    "use strict";
    var clear = parameters.clear;
    var zoomLevel = parameters.zoomLevel;
    // detect the zoom level and request the appropriate facets
    var geoLevel = geohashLevel(zoomLevel, "geohash");

    //we are too deep in, just download the landmarks instead

    if (zoomLevel > 11) {
        loadSmall(1, zoomLevel);

        return;

    }

    var terms = [];

    // this function processes the JSON file requested by jquery
    var buildMap = function (result) {
        // using the facet.stats we return statistics for lat and lng for each geohash
        // we are going to use these statistics to calculate the mean position of the
        // landmarks in each geohash

        // display the number of results
        $("#markersCount").html(result.response.numFound + ' samples in current view');
        // detect empty results set
        if (result.response.numFound === 0) {
            if (clear) {
                assetLayerGroup.clearLayers();
            }
            map.spin(false);
            return;
        }

        var docLat;
        var docLng;
        var docSpc;

        // process the correct geohashed based on the zoomlevel
        switch (zoomLevel) {
            case 1:
            case 2:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_1;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_1;
                docSpc = result.facet_counts.facet_pivot["geohash_1,species_category"];
                break;
            case 3:
            case 4:
            case 5:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_2;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_2;
                docSpc = result.facet_counts.facet_pivot["geohash_2,species_category"];
                break;
            case 6:
            case 7:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_3;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_3;
                docSpc = result.facet_counts.facet_pivot["geohash_3,species_category"];
                break;
            case 8:
            case 9:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_4;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_4;
                docSpc = result.facet_counts.facet_pivot["geohash_4,species_category"];
                break;
            case 10:
            case 11:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_5;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_5;
                docSpc = result.facet_counts.facet_pivot["geohash_5,species_category"];
                break;
            default:
                docLat = result.stats.stats_fields.geo_coords_ll_0___tdouble.facets.geohash_6;
                docLng = result.stats.stats_fields.geo_coords_ll_1___tdouble.facets.geohash_6;
                docSpc = result.facet_counts.facet_pivot["geohash_6,species_category"];
                break;

        }

        // depending on the zoomlevel and the count of landmarks in each geohash we are saving
        // geohashes that contain few enough landmarks to display them using the prune cluster
        // layer. This needs tweaking to get the right balance of info, performance and transfer times
        // The following values seem to work well. Most of the latency is due to SOLR taking a long
        // time to return the landmarks of several geohashes.
        smallClusters = [];

        var populations = []; // keep the total marker count for each geohash
        var statistics = []; // keep the species count for each geohash
        var fullStatistics = []; // keep the species count for each geohash


        for (var key in docLat) {
            // Depending on zoom level and the number of clusters in the geohash add the to smallClusters to be processed later
            // at the same time exclude them from [terms] so as to not display them twice
            if (docLat.hasOwnProperty(key)) {
                var count = docLat[key].count;
                if (count < 2) {
                    smallClusters.push(key);
                    continue;
                }

                if (zoomLevel === 3 && count < 6) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 4 && count < 11) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 5 && count < 21) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 6 && count < 31) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 7 && count < 41) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 8 && count < 51) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel === 9 && count < 61) {
                    smallClusters.push(key);
                    continue;
                }
                if (zoomLevel > 9 && count < 71) {
                    smallClusters.push(key);
                    continue;
                }

                // add to small clusters geohashes with all landmarks from the same location
                //if (docLat[key].min === docLat[key].max && docLng[key].min === docLng[key].max) {
                //    smallClusters.push(key);
                //    continue;
                //}


                // go over the facet pivots and save the population and statistics
                docSpc.forEach(function (element, index, array) {
                    populations[element.value] = element.count;
                    var elStats = [];
                    var fullElStats = [];
                    // check if pinot is empty
                    if (element.pivot) {


                        element.pivot.forEach(function (innElement) {
                            var key = innElement.value,
                                count = innElement.count;

                            elStats[key] = count;

                            //FixMe: Remove these replacements when proper names are returned from the popbio API
                            fullElStats.push({
                                "label": key.replace(/sensu lato/, "sl")
                                    .replace(/chromosomal form/, "cf"),
                                //"label": key,
                                "value": count,
                                "color": (palette[key] ? palette[key] : "#000000")
                            });

                        });
                    } else {

                        console.log("ERROR: Pivot for element " + element.value + "appears to be empty");
                    }
                    statistics[element.value] = elStats;
                    fullStatistics[element.value] = fullElStats;
                });

                // process the JSON returned from SOLR to make it compatible with leaflet-dvf
                var arr = {};
                arr.term = key;
                arr.count = docLat[key].count;
                arr.latLng = [docLat[key].mean, docLng[key].mean];
                arr.bounds = [[docLat[key].min, docLng[key].min], [docLat[key].max, docLng[key].max]];
                arr.population = populations[key];
                arr.stats = statistics[key];
                arr.fullstats = fullStatistics[key];
                //arr.colors = colors;
                //console.log('see:' + arr.stats);
                terms.push(arr);
            }
        }

        var convertedJson = {};
        convertedJson.terms = terms;

        var options = {
            recordsField: "terms",
            latitudeField: "latLng.0",
            longitudeField: "latLng.1",
            displayOptions: {
                "count": {
                    title: function (value) {
                        return value;
                    }
                }
            },
            layerOptions: {
                fill: false,
                stroke: false,
                weight: 0,
                color: "#80FF00",
                dropShadow: false

            },

            setIcon: function (record) {
                var size = 40;
                return new L.Icon.Canvas({
                    iconSize: new L.Point(size, size),
                    className: "prunecluster leaflet-markercluster-icon",
                    population: record.population,
                    stats: record.stats
                });
            },
            onEachRecord: function (layer, record) {
                //console.log("taki"+ record.population);
                //record.stats.push(100);
                layer.on("dblclick", function () {
                    map.fitBounds(record.bounds);
                });
                layer.on("click", function () {
                    updatePieChart(record.population, record.fullstats)
                });
                layer.on("mouseout", function () {
                    //updatePieChart()
                });
            }

        };


        var layer = new L.MarkerDataLayer(convertedJson, options);


        if (clear) {
            assetLayerGroup.clearLayers();
            assetLayerGroup.addLayer(layer);
        } else {
            assetLayerGroup.addLayer(layer);
        }
        // map.addLayer(layer);

        if (smallClusters.length > 0) {
            loadSmall(0, zoomLevel);

        }
        // inform the user that data is loaded
        map.spin(false);

    };


    //ToDo: Define a search handler in SOLR to simplify the URL.
    var url = "http://funcgen.vectorbase.org/popbio-map-preview/asolr/solr/vb_popbio/select?" + qryUrl + "&fq=bundle_name:Sample&fq=has_geodata:true" + "&rows=0" + buildBbox(map.getBounds()) + "&fl=geo_coords&stats=true&stats.field=geo_coords_ll_0___tdouble&stats.field=geo_coords_ll_1___tdouble&stats.facet=" + geoLevel + "&facet=true&facet.limit=-1&facet.sort=count&facet.pivot.mincount=1&facet.pivot=" + geoLevel + ",species_category&wt=json&json.nl=map&json.wrf=?&callback=?";

    //console.log(url);

    // inform the user that data is loading
    map.spin(true);
    $.getJSON(url, buildMap).fail(function () {
        console.log("Ahhh");
        return;
    });


}

function loadSmall(mode, zoomLevel) {
    "use strict";
    var pruneCluster = new PruneClusterForLeaflet(100);

    pruneCluster.BuildLeafletClusterIcon = function (cluster) {
        var e = new L.Icon.MarkerCluster();

        e.stats = cluster.stats;
        e.population = cluster.population;
        return e;
    };


    L.Icon.MarkerCluster = L.Icon.extend({
        options: {
            iconSize: new L.Point(40, 40),
            className: 'prunecluster leaflet-markercluster-icon'
        },

        createIcon: function () {
            // based on L.Icon.Canvas from shramov/leaflet-plugins (BSD licence)
            var e = document.createElement('canvas');
            this._setIconStyles(e, 'icon');
            var s = this.options.iconSize;
            e.width = s.x;
            e.height = s.y;
            this.draw(e.getContext('2d'), s.x, s.y);
            return e;
        },

        createShadow: function () {
            return null;
        },

        draw: function (canvas, width, height) {
            var pi2 = Math.PI * 2;
            var start = Math.PI * 1.5;
            var iconSize = this.options.iconSize.x, iconSize2 = iconSize / 2, iconSize3 = iconSize / 2.5;

            for (var key in this.stats) if (this.stats.hasOwnProperty(key)) {

                var size = this.stats[key] / this.population;
                //console.log(key + ":" + this.stats[key]);

                if (size > 0) {
                    canvas.beginPath();
                    canvas.moveTo(iconSize2, iconSize2);
                    if (palette.hasOwnProperty(key)) {
                        //console.log(key + '=' + palette[key])
                        canvas.fillStyle = palette[key];
                    } else {
                        canvas.fillStyle = palette["others"];
                        //console.log(key + '*' + palette["others"]);
                    }
                    var from = start,
                        to = start + size * pi2;

                    if (to < from) {
                        from = start;
                    }
                    canvas.arc(iconSize2, iconSize2, iconSize2, from, to);

                    start = start + size * pi2;
                    canvas.lineTo(iconSize2, iconSize2);
                    canvas.fill();
                    canvas.closePath();
                }


            }

            canvas.beginPath();
            canvas.fillStyle = 'white';
            canvas.arc(iconSize2, iconSize2, iconSize3, 0, Math.PI * 2);
            canvas.fill();
            canvas.closePath();

            canvas.fillStyle = '#555';
            canvas.textAlign = 'center';
            canvas.textBaseline = 'middle';
            canvas.font = 'bold 12px sans-serif';

            canvas.fillText(this.population, iconSize2, iconSize2, iconSize);
        }
    });

    pruneCluster.BuildLeafletCluster = function (cluster, position) {
        var m = new L.Marker(position, {
            icon: pruneCluster.BuildLeafletClusterIcon(cluster)
        });


        m.on("dblclick", function () {
            // Compute the  cluster bounds (it"s slow : O(n))
            var markersArea = pruneCluster.Cluster.FindMarkersInArea(cluster.bounds);
            var b = pruneCluster.Cluster.ComputeBounds(markersArea);

            if (b) {
                var bounds = new L.LatLngBounds(
                    new L.LatLng(b.minLat, b.maxLng),
                    new L.LatLng(b.maxLat, b.minLng));

                var zoomLevelBefore = pruneCluster._map.getZoom();
                var zoomLevelAfter = pruneCluster._map.getBoundsZoom(bounds, false, new L.Point(20, 20, null));

                // If the zoom level doesn"t change
                if (zoomLevelAfter === zoomLevelBefore) {
                    // Send an event for the LeafletSpiderfier
                    pruneCluster._map.fire("overlappingmarkers", {
                        cluster: pruneCluster,
                        markers: markersArea,
                        center: m.getLatLng(),
                        marker: m
                    });

                }
                else {
                    pruneCluster._map.fitBounds(bounds);
                }
            }
        });
        m.on("click", function () {
            //do click stuff here
            // first we need a list of all categories
            var fullElStats = [];

//FixMe: Remove these replacements when proper names are returned from the popbio API
            var stats = cluster.stats;
            for (var key in stats) {
                fullElStats.push({
                    //"label": key.replace(/^([A-Z])(\w+)(.+)$/, "$1.$3")
                    "label": key.replace(/sensu lato/, "sl")
                        .replace(/chromosomal form/, "cf"),
                    "value": stats[key],
                    "color": (palette[key] ? palette[key] : "#000000")
                });
            }

            updatePieChart(cluster.population, fullElStats);
        });

        m.on("mouseover", function (e) {


        });
        return m;
    };


    // detect the zoom level and request the appropriate facets
    var geoLevel = geohashLevel(zoomLevel, "geohash");

    var geoQuery;

    if (mode === 0) {
        //geoQuery = "(";
        geoQuery = "(";

        for (var i = 0; i < smallClusters.length; i++) {
            if (i === smallClusters.length - 1) {
                geoQuery += smallClusters[i];
                break;
            }
            //geoQuery += smallClusters[i] + " OR ";
            geoQuery += smallClusters[i] + " ";
        }

        geoQuery += ")";
    } else {

        geoQuery = "*";

    }

    var buildMap = function (result) {

        var doc = result.response.docs;

        for (var key in doc) if (doc.hasOwnProperty(key)) {
            var coords = doc[key].geo_coords.split(",");
            var marker = new PruneCluster.Marker(coords[0], coords[1]);
            if (doc[key].hasOwnProperty("species_category")) {
                var species = doc[key].species_category[0];
                marker.category = doc[key].species_category[0];
                //console.log(doc[key].species_category[0]);
            } else {
                console.log(key + ": no species defined")
            }
            marker.data.icon = L.VectorMarkers.icon({
                prefix: 'fa',
                icon: 'circle',
                markerColor: palette[species] ? palette[species] : "red"
            });
            //    gradient: true,
            //    dropShadow: true,
            //    radius: Math.random() * 20,
            //    fillColor: 'hsl(' + Math.random() * 360 + ',100%,50%)'
            //});

            pruneCluster.RegisterMarker(marker);
        }

        if (mode) {
            assetLayerGroup.clearLayers();
            $("#markersCount").html(result.response.numFound + ' samples in current view');

        }
        assetLayerGroup.addLayer(pruneCluster);
        //inform the user loading is done
        map.spin(false);
    };


    //ToDo: Define a search handler in SOLR to simplify the URL.
    var url = "http://funcgen.vectorbase.org/popbio-map-preview/asolr/solr/vb_popbio/select?" + qryUrl + "&fq=bundle_name:Sample&fq=has_geodata:true&q.op=OR" + "&fq=" + geoLevel + ":" + geoQuery + "&rows=10000000" + buildBbox(map.getBounds()) + "&fl=geo_coords,species_category&wt=json&json.nl=map&json.wrf=?&callback=?";

    // inform the user that data is loading
    map.spin(true);
    $.getJSON(url, buildMap);

}

function buildBbox(bounds) {
    /*
     function buildBbox
     date: 11/03/2015
     purpose: a function that generates a SOLR compatible bounding box
     inputs: a LatLngBounds object
     outputs: a SOLR compatible bbox. If the input is not a valid LatLngBounds object it will return a generic bbox that
     covers the whole earth.
     */

    "use strict";
    var solrBbox;

    if (bounds.getEast()) {
        //console.log("bounds IS an object");
        // fix endless bounds of leaflet to comply with SOLR limits
        var south = bounds.getSouth();
        if (south < -90) {
            south = -90;
        }
        var north = bounds.getNorth();
        if (north > 90) {
            north = 90;
        }
        var west = bounds.getWest();
        if (west < -180) {
            west = -180;
        }
        if (west > 180) {
            west = 180;
        }
        var east = bounds.getEast();
        if (east > 180) {
            east = 180;
        }
        if (east < -180) {
            east = -180;
        }
        solrBbox = "&fq=geo_coords:[" + south + "," + west + " TO " + north + "," + east + "]";
    } else {
        //console.log("bounds is not an object");
        solrBbox = "&fq=geo_coords:[-90,-180 TO 90, 180]"; // a generic Bbox
    }
    return (solrBbox);
}

function geohashLevel(zoomLevel, type) {
    /*
     function geohashLevel
     date: 11/03/2015
     purpose: return the proper geohash lever to use
     inputs: zoomLevel (integer), type (string)
     outputs:
     */
    var geoLevel;

    if (type === "geohash") {
        switch (zoomLevel) {
            case 1:
            case 2:
                geoLevel = "geohash_1";
                break;
            case 3:
            case 4:
            case 5:
                geoLevel = "geohash_2";
                break;
            case 6:
            case 7:
                geoLevel = "geohash_3";
                break;
            case 8:
            case 9:
                geoLevel = "geohash_4";
                break;
            case 10:
            case 11:
                geoLevel = "geohash_5";
                break;
            default:
                geoLevel = "geohash_6";
                break;

        }
    } else {
        // does nothing for now
        //TODO: Automatically construct the proper facet statistics object based on zoomLevel
    }
    return (geoLevel);
}

function buildPalette(items, nmColors, paletteType) {
    /*
     function buildPalette
     date: 17/03/2015
     purpose:
     inputs: {items} a list of items to be associated with colors, {mColors} the number of colors in the palette
     {paletteType} 1 for Kelly's 2 for boytons
     outputs: an associative array with items names as the keys and color as the values
     */
    "use strict";

    var newPalette = [];

    // from http://stackoverflow.com/questions/470690/how-to-automatically-generate-n-distinct-colors
    var kelly_colors_hex = [
        "#FFB300", // Vivid Yellow
        "#803E75", // Strong Purple
        "#FF6800", // Vivid Orange
        "#A6BDD7", // Very Light Blue
        "#C10020", // Vivid Red
        "#CEA262", // Grayish Yellow
        "#817066", // Medium Gray

        // The following don't work well for people with defective color vision
        "#007D34", // Vivid Green
        "#F6768E", // Strong Purplish Pink
        "#00538A", // Strong Blue
        "#FF7A5C", // Strong Yellowish Pink
        "#53377A", // Strong Violet
        "#FF8E00", // Vivid Orange Yellow
        "#B32851", // Strong Purplish Red
        "#F4C800", // Vivid Greenish Yellow
        "#7F180D", // Strong Reddish Brown
        "#93AA00", // Vivid Yellowish Green
        "#593315", // Deep Yellowish Brown
        "#F13A13", // Vivid Reddish Orange
        "#232C16" // Dark Olive Green
    ];

    // from http://alumni.media.mit.edu/~wad/color/palette.html
    var boytons_colors_hex = [
        //"#000000", // Black
        "#575757", // Dark Gray
        "#A0A0A0", // Light Gray
        "#FFFFFF", // White
        "#2A4BD7", // Blue
        "#1D6914", // Green
        "#814A19", // Brown
        "#8126C0", // Purple
        "#9DAFFF", // Light Purple
        "#81C57A", // Light Green
        "#E9DEBB", // Cream
        "#AD2323", // Red
        "#29D0D0", // Teal
        "#FFEE33", // Yellow
        "#FF9233", // Orange
        "#FFCDF3", // Pink
    ];

    var noItems = items.length,
        stNoItems = noItems;

    for (var i = 0; i < nmColors; i++) {
        var item = items[i][0];
        newPalette[item] = kelly_colors_hex[i];
        //console.log(item);

        noItems--; // track how many items don't have a proper color
    }

    var lumInterval = 0.5 / noItems,
        lum = 0.7;
    for (var c = 0; c < noItems; c++) {
        var element = stNoItems - noItems + c;
        var item = items[element][0];
        newPalette[item] = colorLuminance("#FFFFFF", -lum);
        lum -= lumInterval;
        //console.log(item);


    }

    newPalette["others"] = "radial-gradient(" + colorLuminance("#FFFFFF", -0.7) + ", " + colorLuminance("#FFFFFF", -lum) + ")";

    return newPalette;
}

function sortHashByValue(hash) {
    var tupleArray = [];
    for (var key in hash) tupleArray.push([key, hash[key]]);
    tupleArray.sort(function (a, b) {
        return b[1] - a[1]
    });
    return tupleArray;
}

function updatePieChart(population, stats) {
    if (stats) {

        var height = 500;
        var width = $("#graphs").width();

        nv.addGraph(function () {
            var chart = nv.models.pieChart()
                .x(function (d) {
                    return d.label
                })
                .y(function (d) {
                    return d.value
                })
                .color(function (d) {
                    return d.data["color"]
                })
                .showLabels(true)     //Display pie labels
                .labelThreshold(.05)  //Configure the minimum slice size for labels to show up
                .labelType("percent") //Configure what type of data to show in the label. Can be "key", "value" or "percent"
                .donut(true)          //Turn on Donut mode. Makes pie chart look tasty!
                .donutRatio(0.5)     //Configure how big you want the donut hole size to be.
                .growOnHover(false);

            d3.select("#piechart")
                .datum(stats)
                .transition().duration(800)
                .attr('width', width)
                .attr('height', height)
                .call(chart);


            nv.utils.windowResize(              //Updates the window resize event callback.
                function () {
                    chart.update();         //Renders the chart when window is resized.
                }
            );


            //nv.utils.windowResize(chart.update());
            return chart;
        });


    } else {


    }
};

$.fn.redraw = function () {
    /*
     function redraw
     date: 20/03/2015
     purpose: This snippet can help in cases where the browser doesn't redraw an updated element properly.
     inputs: call it like $('.theElement').redraw();
     outputs:
     */

    $(this).each(function () {
        var redraw = this.offsetHeight;
    });
};

function colorLuminance(hex, lum) {
    /*
     function colorLuminance
     date: 20/03/2015
     purpose: extracts the red, green and blue values in turn, converts them to decimal, applies the luminosity factor,
     and converts them back to hexadecimal.
     inputs: <hex> original hex color value <lum> level of luminosity from 0 (lightest) to 1 (darkest)
     outputs: a hex represantation of the color
     source: http://www.sitepoint.com/javascript-generate-lighter-darker-color/
     */

    // validate hex string
    "use strict";

    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    lum = lum || 0;

    // convert to decimal and change luminosity
    var rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
        c = parseInt(hex.substr(i * 2, 2), 16);
        c = Math.round(Math.min(Math.max(0, c + (c * lum)), 255)).toString(16);
        rgb += ("00" + c).substr(c.length);
    }

    return rgb;
}

function filterMarkers(items) {
    if (items.length === 0) {
        qryUrl = 'q=*';
        loadSolr({clear: 1, zoomLevel: map.getZoom()});
        return;
    }

    //qryUrl = 'q=';
    var terms = new Object;
    //items = $("#search_ac").tagsinput('items');
    items.forEach(function (element) {

        if (terms.hasOwnProperty(element.field)) {
            if (element.qtype == 'exact') {
                terms[element.field].push('"' + element.value + '"');
            } else {
                terms[element.field].push(element.value + '*');
                console.log("inexact");
            }
        } else {
            terms[element.field] = [];
            if (element.qtype == 'exact') {
                terms[element.field].push('"' + element.value + '"');
            } else {
                terms[element.field].push(element.value + '*');
                console.log("inexact");
            }
        }
    });

    var tlen = Object.keys(terms).length;
    var i = 0;
    for (var obj in terms) {
        var arr = terms[obj];
        var qry = '';
        var alen = arr.length;
        arr.forEach(function (element, index) {
            if (index < alen - 1) {
                qry += element + ' OR '
            } else {
                qry += element
            }
        });
        if (i === 0) {
            //qryUrl = ' AND (';
            qryUrl = 'q=(';
        }
        if (i < tlen - 1) {
            if (obj === 'anywhere') {   // search in any field
                qryUrl += '(' + qry + ') OR ';
            } else {
                qryUrl += obj + ':(' + qry + ') OR ';
            }

        } else {
            if (obj === 'anywhere') {
                qryUrl += '(' + qry + '))';
            } else {
                qryUrl += obj + ':(' + qry + '))';
            }

        }


        //console.log('lakis' + qryUrl);
        i++;
    }
    loadSolr({clear: 1, zoomLevel: map.getZoom()})
}

function mapTypeToField(type) {
    switch (type) {
        case "Taxonomy":
            return "species_cvterms"
        case "Title":
            return "label"
        default :
            return type.toLowerCase()

    }

}

function mapTypeToIcon(type) {
    switch (type) {
        case "Taxonomy":
            return '<i class="fa fa-sitemap"></i>';
        case "Title":
            return '<i class="fa fa-info-circle"></i>';
        default :
            return '<i class="fa fa-camera-retro"></i>';

    }

}