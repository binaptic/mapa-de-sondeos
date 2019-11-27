$(document).ready(function() {
  // Esto no afecta a los links de los popovers xq todavía no han sido generados en el DOM
  $("a[href^='http']").attr("target", "_blank");

  // ACTIVAMOS LOS TOOLTIPS DE BOOTSTRAP
  $("[data-toggle='tooltip']").tooltip();

  $("#slct_buscar").val("localidad");
  $("#buscar").val("");

  $("#buscar").keypress(function(event) {
    var keycode = event.keyCode || event.which;
    if (keycode == "13") {
      event.preventDefault(); // Evita que se reinicie el mapa (el comportamiento por defecto del input es submit)
      buscar();
    }
  });

  // PROXY
  // cors-anywhere
  var proxy = "http://localhost:3000/"; // localhost
  // var proxy = "https://cors-anywhere.herokuapp.com/";

  // ESTILOS

  var stlSondeo = new ol.style.Style({
    image: new ol.style.RegularShape({
      fill: new ol.style.Fill({
        color: "red"
      }),
      stroke: new ol.style.Stroke({
        color: "black",
        width: 1
      }),
      points: 3,
      radius: 12,
      rotation: Math.PI,
      angle: 0
    })
  });

  // MAPAS BASE

  var osm = new ol.layer.Tile({
    source: new ol.source.OSM(),
    //id:0,// Id de la capa
    name: "OpenStreetMap"
  });

  // CAPAS

  // WMS 1.1.1
  var catastroWMS = new ol.source.TileWMS({
    params: {
      VERSION: "1.1.1",
      LAYERS: "Catastro"
    },
    projection: "EPSG:3857",
    url: "http://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx"
  });

  var catastro = new ol.layer.Tile({
    source: catastroWMS,
    //id:0,// Id de la capa
    name: "Catastro WMS",
    visible: false
  });

  var source_sondeos = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    projection: "EPSG:3857",
    url: "datos/sondeos_shp.geojson"
  });

  var clusterSource = new ol.source.Cluster({
    distance: 50,
    source: source_sondeos
  });

  var styleCache = {};
  var clusters = new ol.layer.Vector({
    source: clusterSource,
    name: "Clusters Sondeos",
    style: function(feature) {
      var size = feature.get("features").length;
      var style = styleCache[size];
      if (!style) {
        style = [
          new ol.style.Style({
            image: new ol.style.Circle({
              radius: 16,
              //radius: (parseInt(size / 10) + 3) * 5,
              stroke: new ol.style.Stroke({
                color: "#fff"
              }),
              fill: new ol.style.Fill({
                color: "#3399CC"
              })
            }),
            text: new ol.style.Text({
              font: "bold 12px lato",
              text: size.toString(),
              fill: new ol.style.Fill({
                color: "#fff"
              })
            })
          })
        ];
        styleCache[size] = style;
      }
      return style;
    }
  });

  // OVERLAYS (Popups y Markers)

  var containerInfo = document.getElementById("popoverInfo");

  var infoOverlay = new ol.Overlay({
    element: containerInfo,
    positioning: "bottom-center",
    stopEvent: false // IMPORTANTE: Para que funcione el botón
  });

  var containerPoi = document.getElementById("poi");

  var poiOverlay = new ol.Overlay({
    element: containerPoi,
    positioning: "bottom-center",
    stopEvent: false // IMPORTANTE: Para que funcione el botón
  });

  var containerPopoverPoi = document.getElementById("popoverPoi");

  var popoverPoiOverlay = new ol.Overlay({
    element: containerPopoverPoi,
    positioning: "bottom-center",
    stopEvent: false // IMPORTANTE: Para que funcione el botón
  });

  // VISTA Y MAPA

  var vista = new ol.View({
    projection: "EPSG:3857",
    center: [0, 0],
    //center: ol.proj.transform([2.1833, 41.3833], 'EPSG:4326', 'EPSG:3857'),
    zoom: 2,
    extent: [
      -2760426.426931494,
      3103200.9887151076,
      1935864.5909097355,
      5497820.210833109
    ],
    minZoom: 6
  });

  var mapa = new ol.Map({
    layers: [osm, catastro, clusters],
    //controls: [],
    overlays: [infoOverlay, poiOverlay, popoverPoiOverlay],
    target: "mapa",
    view: vista,
    interactions: ol.interaction.defaults({ doubleClickZoom: false })
  });

  // CONTROLES

  //mapa.addControl(new ol.control.Attribution({collapsible: false}));
  mapa.addControl(new ol.control.FullScreen());
  //mapa.addControl(new ol.control.Zoom());

  $("#mostrarCatastro")
    .prop("checked", false)
    .click(function() {
      if ($(this).is(":checked")) {
        catastro.set("visible", true);
      } else {
        catastro.set("visible", false);
      }
    });

  // http://stackoverflow.com/questions/31297721/how-to-get-a-layer-from-a-feature-in-openlayers-3
  /**
   * This is a workaround.
   * Returns the associated layer.
   * @param {ol.Map} map.
   * @return {ol.layer.Vector} Layer.
   */
  ol.Feature.prototype.getLayer = function(map) {
    var this_ = this,
      layer_,
      layersToLookFor = [];
    /**
     * Populates array layersToLookFor with only
     * layers that have features
     */
    var check = function(layer) {
      var source = layer.getSource();
      if (source instanceof ol.source.Vector) {
        var features = source.getFeatures();
        if (features.length > 0) {
          layersToLookFor.push({
            layer: layer,
            features: features
          });
        }
      }
    };
    //loop through map layers
    map.getLayers().forEach(function(layer) {
      if (layer instanceof ol.layer.Group) {
        layer.getLayers().forEach(check);
      } else {
        check(layer);
      }
    });
    layersToLookFor.forEach(function(obj) {
      var found = obj.features.some(function(feature) {
        return this_ === feature;
      });
      if (found) {
        //this is the layer we want
        layer_ = obj.layer;
      }
    });
    return layer_;
  };

  // Popover del sondeo
  function mostrarPopoverInfo(coord, cont) {
    $(containerPopoverPoi).popover("destroy");
    if ($(containerPoi).is(":visible")) {
      $(containerPoi).hide();
    }
    infoOverlay.setPosition(coord);
    $(containerInfo).css("padding-bottom", "0px");
    $(containerInfo).attr("data-container", "#popoverInfo");
    $(containerInfo).attr("data-placement", "top");
    $(containerInfo).attr("data-html", true);
    $(containerInfo).attr("data-content", cont);
    // $(containerInfo).attr('data-trigger', 'focus');// Para q solo se cierre al hacer clic fuera del popover
    $(containerInfo).popover("show");
    $(".popover-content font").attr("size", "-1");
    $(".popover-content a[href^='http']").attr("target", "_blank");
  }

  // Popover tras buscar por localidad
  function mostrarPopoverPoi(coord, cont) {
    $(containerInfo).popover("destroy");
    popoverPoiOverlay.setPosition(coord);
    $(containerInfo).attr("data-container", "#popoverPoi");
    //$(containerInfo).attr('data-trigger', 'focus');// Para q solo se cierre al hacer clic fuera del popover
    $(containerPopoverPoi).attr("data-placement", "top");
    $(containerPopoverPoi).attr("data-html", true);
    $(containerPopoverPoi).attr("data-content", cont);
    $(containerPopoverPoi).popover("show");
  }

  // Popover tras buscar por referencia catastral
  function mostrarPopoverReferencia(coord, cont) {
    $(containerPopoverPoi).popover("destroy");
    infoOverlay.setPosition(coord);
    $(containerInfo).css("padding-bottom", "48px");
    $(containerInfo).attr("data-container", "#popoverInfo");
    $(containerInfo).attr("data-placement", "top");
    $(containerInfo).attr("data-html", true);
    $(containerInfo).attr("data-content", cont);
    //$(containerInfo).attr('data-trigger', 'focus');// Para q solo se cierre al hacer clic fuera del popover
    $(containerInfo).popover("show");
    $(".popover-content font").attr("size", "-1");
    $(".popover-content a[href^='http']").attr("target", "_blank");
  }

  // EVENTOS DEL MAPA

  var nSondeo, urlMapama;
  mapa.on("singleclick", function(e) {
    var cluster = mapa.forEachFeatureAtPixel(e.pixel, function(feature) {
      return feature;
    });

    consultaCatastro = function(cluster) {
      var geometria = cluster.getGeometry();
      var coordenadas = geometria.getCoordinates();
      var resolucion = vista.getResolution();
      var dimensiones = mapa.getSize();
      var extension = mapa.getView().calculateExtent(dimensiones);
      var urlCapa = catastro.getSource().getUrls()[0];
      var versionCapa = catastro.getSource().getParams()[
        Object.keys(catastro.getSource().getParams())[0]
      ];
      var nombreCapa = catastro.getSource().getParams()[
        Object.keys(catastro.getSource().getParams())[1]
      ];
      // console.info("Nombre de la capa que se pide al servidor: ", nombreCapa);
      var proyeccionCapa = catastro.getSource().getProjection();
      var epsgCapa = catastro
        .getSource()
        .getProjection()
        .getCode();
      var tileGrid = catastro.getSource().getTileGrid();
      if (!tileGrid) {
        tileGrid = catastro
          .getSource()
          .getTileGridForProjection(proyeccionCapa);
      }
      var tileCoord = tileGrid.getTileCoordForCoordAndResolution(
        coordenadas,
        resolucion
      );
      if (tileGrid.getResolutions().length <= tileCoord[0]) {
        return undefined;
      }
      var tileResolution = tileGrid.getResolution(tileCoord[0]);
      var tileExtent = tileGrid.getTileCoordExtent(tileCoord, extension);
      var x = Math.floor((coordenadas[0] - tileExtent[0]) / tileResolution);
      var y = Math.floor((tileExtent[3] - coordenadas[1]) / tileResolution);
      var bboxCapa = tileExtent;

      var urlAjax =
        proxy +
        urlCapa +
        "?SERVICE=WMS" +
        "&VERSION=" +
        versionCapa +
        "&REQUEST=GetFeatureInfo" +
        "&FORMAT=" +
        encodeURIComponent("image/png") +
        "&TRANSPARENT=true" +
        "&QUERY_LAYERS=" +
        nombreCapa +
        "&LAYERS=" +
        nombreCapa +
        "&INFO_FORMAT=" +
        encodeURIComponent("text/html") +
        "&I=" +
        x +
        "&J=" +
        y +
        "&WIDTH=256" +
        "&HEIGHT=256" +
        //"&CRS=" + encodeURIComponent(epsgCapa) +// v 1.3.0
        "&SRS=" +
        encodeURIComponent(epsgCapa) +
        "&BBOX=" +
        encodeURIComponent(bboxCapa);
      // console.log(urlAjax);
      return urlAjax;
    };

    if (cluster) {
      var geometria = cluster.getGeometry();
      var coordenadas = geometria.getCoordinates();
      if (cluster.getProperties().features.length == 1) {
        nSondeo = cluster.getProperties().features[0].get("N_SONDEO");
        urlMapama =
          "https://sig.mapama.gob.es/93/ClienteWS/intranet/Default.aspx?nombre=SONDEOS&claves=N_SONDEO&valores=" +
          nSondeo +
          "";
        $.ajax({
          url: consultaCatastro(cluster)
        }).done(function(respuesta) {
          // console.log(respuesta);
          var contenido =
            "<span>Sondeo Nº " +
            nSondeo +
            "</span><br>" +
            '<a role="button" class="btn btn-info btn-sm" href="' +
            urlMapama +
            '" style="margin-bottom:18px">Ficha sondeo</a><br>' +
            respuesta;

          // Centramos el POI en el mapa (TODO: Hacerlo con animación suave)
          // mapa.getView().setCenter(coordenadas);

          mostrarPopoverInfo(coordenadas, contenido);
        });
      } else {
        // Desclusterizar
        var clusterFeatures = cluster.getProperties().features;
        var clusterExtent = ol.extent.createEmpty();
        for (var j = 0, jj = clusterFeatures.length; j < jj; ++j) {
          ol.extent.extend(
            clusterExtent,
            clusterFeatures[j].getGeometry().getExtent()
          );
        }
        mapa.getView().fit(clusterExtent, mapa.getSize());
      }
    } else {
      console.log("TODO: Ref. catastral de este punto");
    }
  });

  // BÚSQUEDAS

  function mostrarAviso(texto) {
    $("#aviso .modal-body p").text(texto);
    $("#aviso").modal("show");
  }

  function crearPoi(coord) {
    if ($(containerPoi).is(":visible")) {
      $(containerPoi).hide();
    }
    poiOverlay.setPosition(coord);
  }

  function buscarLocalidad() {
    var localidad = $("#buscar").val();
    var urlLocalidad = proxy + "http://nominatim.openstreetmap.org/search.php";

    $.ajax({
      url: urlLocalidad,
      data: {
        q: localidad,
        format: "json",
        limit: 1
      }
    }).done(function(respuesta) {
      // console.log(respuesta);

      // Comprobamos que existe un resultado para la búsqueda
      if (typeof respuesta[0] === "undefined") {
        mostrarAviso("Localidad no encontrada");
        return;
      }

      var longitud = parseFloat(respuesta[0].lon);
      var latitud = parseFloat(respuesta[0].lat);

      var coordenadas = ol.proj.transform(
        [longitud, latitud],
        "EPSG:4326",
        "EPSG:3857"
      );

      //TODO: comprobar que las coordenadas no se encuentren fuera del bounding box:
      //TODO: http://openlayers.org/en/master/apidoc/ol.extent.html#.boundingExtent

      //TODO: pasar a variable tb en la vista
      var extension = [
        -2760426.426931494,
        3103200.9887151076,
        1935864.5909097355,
        5497820.210833109
      ];
      // var extension = mapa.getView().getProperties("extent");
      // console.log(extension);
      // console.log(ol.extent.containsCoordinate(extension, coordenadas));

      if (ol.extent.containsCoordinate(extension, coordenadas)) {
        // console.info("Dentro de los límites");

        // Centramos el POI en el mapa (TODO: Hacerlo con animación suave)
        mapa.getView().setCenter(coordenadas);

        // Una vez acaba el desplazamiento del mapa, creamos el POI y su popover, si no, el popover no aparece
        var terminarMover = function(evt) {
          // console.info("terminarMover");
          crearPoi(coordenadas);
          mostrarPopoverPoi(coordenadas, localidad.toUpperCase());
        };

        var activarListener = mapa.once("moveend", terminarMover); // once en vez de on para un único evento (no es necesario desactivarlo al finalizar el moveend)
      } else {
        mostrarAviso("Fuera de los límites, especifique más la dirección");
      }
    });
  }

  function buscarReferencia() {
    var referencia = $("#buscar").val();
    var urlReferencia =
      proxy +
      "http://ovc.catastro.meh.es/Cartografia/WMS/BuscarParcelaGoogle.aspx?RefCat=" +
      referencia +
      "";

    $.ajax(urlReferencia).done(function(kml) {
      // KML a objeto GeoJSON (togeojson.js)
      var geojsonObj = toGeoJSON.kml(kml);
      // console.log(geojsonObj);

      // Comprobamos que existe un resultado para la búsqueda
      if (typeof geojsonObj.features[0] === "undefined") {
        mostrarAviso("Referencia no encontrada");
        return;
      }

      var nombre = geojsonObj.features[0].properties.name;
      var descripcion = geojsonObj.features[0].properties.description;

      // Esta es la FeatureCollection, q solamente tiene un elemento
      var elemsReferencia = new ol.format.GeoJSON().readFeatures(geojsonObj, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
        name: nombre
      });

      // console.log(elemsReferencia[0].get("name"));
      var geometria = elemsReferencia[0].getGeometry();
      var coordenadas = geometria.getCoordinates();
      var contenido = nombre + "<br>" + descripcion;

      // Centramos el POI en el mapa (TODO: Hacerlo con animación suave)
      mapa.getView().setCenter(coordenadas);

      // Una vez acaba el desplazamiento del mapa, creamos el POI y su popover, si no, el popover no aparece
      var terminarMover = function(evt) {
        // console.info("terminarMover");
        crearPoi(coordenadas);
        mostrarPopoverReferencia(coordenadas, contenido);
      };

      var activarListener = mapa.once("moveend", terminarMover);
    });
  }

  function buscar() {
    var criterio = $("#slct_buscar").val();

    if (criterio == "localidad") {
      buscarLocalidad();
    } else if (criterio == "referencia") {
      buscarReferencia();
    }
  }

  $("#btn_buscar").click(function() {
    if ($("#buscar").val() == "") {
      mostrarAviso("Introduce una localidad o referencia catastral");
    } else {
      buscar();
    }
  });

  // GEOLOCALIZACIÓN

  function geolocalizacion() {
    var geolocation = new ol.Geolocation({
      projection: vista.getProjection(),
      tracking: true
    });
    geolocation.once("change:position", function() {
      //marcarPosicion

      vista.setCenter(geolocation.getPosition());
      vista.setResolution(2.388657133911758);

      var coordenadas = geolocation.getPosition();
      //var x = coordenadas[0].toFixed(3);
      //var y = coordenadas[1].toFixed(3);

      var posicionStyle = new ol.style.Style({
        image: new ol.style.Icon({
          anchor: [0.5, 48],
          anchorXUnits: "fraction",
          anchorYUnits: "pixels",
          opacity: 1,
          src: "img/map-marker.svg"
        })
      });

      //crearPoi(coordenadas, posicionStyle, 'Mi posición');
      //----------------------------------------------------
      var posicion = new ol.Feature({
        geometry: new ol.geom.Point(coordenadas)
        //name: txt
      });
      posicion.setStyle(posicionStyle);
      var posicionSource = new ol.source.Vector({
        //features: [posicion]
      });
      var posicionLayer = new ol.layer.Vector({
        source: posicionSource,
        name: "Posición"
      });
      posicionSource.addFeature(posicion);
      mapa.addLayer(posicionLayer);

      // NOTA: Código anterior (¿Más cambios en los selectores?)
      /*if (containerPoi.is(":visible")) {
             containerPoi.hide();
             }*/
      // Código nuevo:
      if ($(containerPoi).is(":visible")) {
        $(containerPoi).hide();
      }

      mostrarPopoverPoi(coordenadas, "Mi posición");
      //----------------------------------------------------

      //geolocalizadoUsuario
    });
  }

  geolocalizacion();

  $("#btn_geoloc").click(function() {
    geolocalizacion();
  });

  // Use FastClick to eliminate the 300ms delay between a physical tap
  // and the firing of a click event on mobile browsers.
  // See http://updates.html5rocks.com/2013/12/300ms-tap-delay-gone-away
  // for more information.
  document.addEventListener("DOMContentLoaded", function() {
    FastClick.attach(document.body);
  });
});
