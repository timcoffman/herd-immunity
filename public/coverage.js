/*
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us.topo.json
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us-s1.topo.json
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us-s3.topo.json
 * https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fzips_us_topo.json
*/

var CoverageTool = window.CoverageTool = function CoverageTool( d3, topojson ) {
  this.d3 = d3 ;
  this.topojson = topojson ;
} ;

CoverageTool.prototype.heatMap = function( level, opacity ) {
  var begin = { r: 255, g:   0, b: 0 } ;
  var end   = { r:   0, g: 255, b: 0 } ;
  if ( typeof opacity == 'undefined' ) opacity = 1.0 ;
  return "rgba("
      + Math.floor( begin.r + (end.r - begin.r) * level )
      + ","
      + Math.floor( begin.g + (end.g - begin.g) * level )
      + ","
      + Math.floor( begin.b + (end.b - begin.b) * level )
      + ","
      + opacity
      + ")"
      ;
} ;

CoverageTool.prototype.initializeLegend = function( container ) {
    var self = this ;
    var d3 = self.d3 ;

    var svg = d3.select(container[0]).append("svg")
      .attr("viewBox", "0,0 100,10")
      .attr("preserveAspectRatio", "xMinYMin meet")
      ;
    var g = svg.append("g");
    for ( var i = 0; i < 10; ++i ) {
      var block = g.append("rect")
        .attr("x", 10*i )
        .attr("y", 0 )
        .attr("height", 10)
        .attr("width", 10)
        .style("fill", self.heatMap( i/10 ) )
        ;
      block.append("text")
        .attr("x", 10*i )
        .attr("y", 0 )
        .attr("dy", ".35em")
        .text( i*10 + "%" )
        ;
    }
} ;

CoverageTool.prototype.initializeMap = function( container, postalCodes ) {
  var self = this ;
  var d3 = self.d3 ;
  
  var panel = $('<div class="panel"><div>Influenza</div><div>')
    .appendTo( $(container) )
    ;
  var mapPanel = $('<div class="panel"/>')
    .appendTo( panel )
    ;
  
  var projection = d3.geo.albersUsa();

  var svg = d3.select(panel[0]).append("svg")
      .attr("viewBox", "0,0 900,600")
      .attr("preserveAspectRatio", "xMinYMin meet");
  var path = d3.geo.path()
      .projection(projection);
  var g = svg.append("g");
  var gPostalCodes = g.append("g");
  var gCounties = g.append("g");
  
  d3.json("https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fzips_us_topo.json", function(error, topology) {
    var info = self.loadPostalCodeTopology( path, gPostalCodes, topology, postalCodes ) ;
    var center = info.center ;
  
    g
        // .transition()
        // .duration(750)
        .attr("transform", "translate(" + 900 / 2 + "," + 600 / 2 + ") scale(" + 80 + ") translate(" + -center[0] + "," + -center[1] + ")")
        // .style("stroke-width", 1.5 / 80 + "px");


    $.getJSON( '/flu?postalCodes=' + info.focusedPostalCodes.join(",") )
      .done( function(data) {
        for ( var postalCode in data ) {
          var color1 = self.heatMap(data[postalCode],0.0) ;
          var color2 = self.heatMap(data[postalCode],1.0) ;
          var c = info.center ;
          d3.select('path#pc-' + postalCode)
            .style("fill", color1 )
            .transition()
            .duration( function(d) {
              var c2 = path.centroid( d ) ;
              var d = (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) / ( 10*10 );
              return 100 * d ;
              } )
            .style("fill", color2 )
            ;
          //console.log( "heatMap(" + postalCode + " ->" + color +  "):", $('path#pc-' + postalCode).css('fill') ) ;
        }
      })
      ;
    
    d3.json("https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fus.topo.json", function(error,topology) {
      self.loadGeneralTopology( path, gCounties, topology, center ) ;
    }) ;

  });
  
} ;

CoverageTool.prototype.loadGeneralTopology = function( path, g, topology, c  ) {
  var self = this ;
  var d3 = self.d3 ;
  var topojson = self.topojson ;

  var allCountyBoundaries = topojson.feature(topology, topology.objects.county).features ;
  var focusedCountyBoundaries = allCountyBoundaries.filter( function(d) {
    var c2 = path.centroid( d ) ;
    return (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) < 10 * 10 ;
  } ) ;
  
  g.selectAll("path")
    .data(focusedCountyBoundaries, function(d) { return d.properties.id ; } )
  .enter()
    .append("path")
    .attr("d", path)
    .classed("county",true)
    .attr("id", function(d) { return "pc-" + d.properties.zip } )
    ;

} ;

CoverageTool.prototype.loadPostalCodeTopology = function( path, g, topology, postalCodes  ) {
  var self = this ;
  var d3 = self.d3 ;
  var topojson = self.topojson ;
  
  var allPostalCodeBoundaries = topojson.feature(topology, topology.objects.zip_codes_for_the_usa).features ;
  var targetedPostalCodeBoundaries = allPostalCodeBoundaries.filter( function(d) { return postalCodes.indexOf(d.properties.zip) >= 0 ; } ) ;

  var c = path.centroid( targetedPostalCodeBoundaries[0] ) ;
  var x = c[0] ;
  var y = c[1] ;
  var focusedPostalCodeBoundaries = allPostalCodeBoundaries.filter( function(d) {
    var c2 = path.centroid( d ) ;
    return (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) < 10 * 10 ;
  } ) ;

  var focusedPostalCodes = focusedPostalCodeBoundaries.map( function(d) {
    return d.properties.zip ;
  }) ;
  
  g.selectAll("path")
    .data(focusedPostalCodeBoundaries, function(d) { return d.properties.zip ; })
  .enter()
    .append("path")
    .attr("d", path)
    .attr("id", function(d) { return "pc-" + d.properties.zip } )
    .classed("postal-code",true)
    .classed("target",function(d,i) { return postalCodes.indexOf(d.properties.zip) >= 0 ; } )
    ;

  return { center: c, focusedPostalCodes: focusedPostalCodes } ;
};

