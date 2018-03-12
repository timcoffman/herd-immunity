/*
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us.topo.json
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us-s1.topo.json
 * https://raw.githubusercontent.com/jgoodall/us-maps/master/topojson-simplified/us-s3.topo.json
 * https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fzips_us_topo.json
*/

var CoverageTool = window.CoverageTool = function CoverageTool( d3, topojson ) {
  this.d3 = d3 ;
  this.topojson = topojson ;
  this.scale = 80 ;
} ;

CoverageTool.prototype.heatMap = function( level, opacity ) {
  var low   = { r: 255, g:   0, b:   0 } ;
  var mid   = { r:   0, g:   0, b: 255 } ;
  var high  = { r:   0, g: 255, b:   0 } ;
  var begin ;
  var end ;
  if ( level < 0.5 ) {
    begin = low ;
    end = mid ;
    level = level*2 ;
  } else {
    begin = mid ;
    end = high ;
    level = (level-0.5)*2 ;
  }
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
    .attr("viewBox", "0,0 110,5")
    .attr("preserveAspectRatio", "xMinYMin meet")
    ;
  var g = svg.append("g");
  var block = g.selectAll("rect")
    .data( [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ] )
    .enter()
      .append("g")
      .attr("transform", function(lv) { return "translate(" + lv*10 + ", 0)"; } )
    ;
  block
    .append("rect")
      .attr("height", "100%")
      .attr("width", 10)
      .style("fill", function(lv) { return self.heatMap( lv/10 ) ; } )
      ;
  block
    .append("text")
      .attr("x", "5" )
      .attr("y", "50%" )
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text( function(lv) { return lv*10 + "%" ; } )
      ;
} ;

CoverageTool.prototype.initializeMap = function( container, vaccination, postalCodes ) {
  var self = this ;
  var d3 = self.d3 ;
  
  var projection = d3.geo.albersUsa();

  var svg = d3.select(container[0]).append("svg")
      .attr("viewBox", "0,0 900,600")
      .attr("preserveAspectRatio", "xMinYMin meet");
  var path = d3.geo.path()
      .projection(projection);
  var g = svg.append("g");
  var gPostalCodes = g.append("g");
  var gCounties = g.append("g");
  
  d3.json("/topology/postal-code/" + postalCodes.join(','), function(error, topologyInfo) {
    
    if ( error ) {
      $('<div>' + error + '</div>')
        .appendTo( $('#error-container') ) ;
      console.error( error ) ;
    } else {        

      var info = self.loadPostalCodeTopology( path, gPostalCodes, topologyInfo, vaccination, postalCodes ) ;
      var center = info.center ;

      g
        .attr("transform", "translate(" + 900 / 2 + "," + 600 / 2 + ") scale(" + self.scale + ") translate(" + -center[0] + "," + -center[1] + ")")
        ;

      g
        .append("circle")
        .classed("target",true)
        .attr("cx", center[0] )
        .attr("cy", center[1] )
        .attr("r", "0.05%")
        ;

      $.getJSON( '/vaccination/WI/' + vaccination + '?postalCodes=' + info.focusedPostalCodes.join(",") )
        .done( function(data) {
          for ( var postalCode in data ) {
            var color1 = self.heatMap(data[postalCode],0.0) ;
            var color2 = self.heatMap(data[postalCode],1.0) ;
            var c = info.center ;
            d3.select('path#v-' + vaccination + '-pc-' + postalCode)
              // .style("fill", color1 )
              // .transition()
              // .duration( function(d) {
              //   var c2 = path.centroid( d ) ;
              //   var d = (c2[0] - c[0])*(c2[0] - c[0]) + (c2[1] - c[1])*(c2[1] - c[1]) / ( 10*10 );
              //   return 100 * d ;
              //   } )
              .style("fill", color2 )
              .select("title")
                .text(function(d) { return postalCode + ": " + Math.floor(100 * data[postalCode]) + "%" ; } )

              ;
            //console.log( "heatMap(" + postalCode + " ->" + color +  "):", $('path#pc-' + postalCode).css('fill') ) ;
          }
        })
        ;

      d3.json("topology/county?cx=" + center[0] + "&cy=" + center[1], function(error,topologyInfo) {
        if ( error ) {
          $('<div>' + error + '</div>')
            .appendTo( $('#error-container') ) ;
          console.error( error ) ;
        } else {        
          self.loadGeneralTopology( path, gCounties, topologyInfo, vaccination ) ;
        }
      }) ;
      
    }

  });
  
} ;

CoverageTool.prototype.loadGeneralTopology = function( path, g, topologyInfo, vaccination  ) {
  var self = this ;
  var d3 = self.d3 ;

  var focusedCountyBoundaries = topologyInfo.focusedCountyBoundaries;
  
  g.selectAll("path")
    .data(focusedCountyBoundaries, function(d) { return d.id ; } )
  .enter()
    .append("path")
    .attr("d", path)
    .classed("county",true)
    .attr("id", function(d) { return "v-" + vaccination + "-c-" + d.id } )
    ;

} ;

CoverageTool.prototype.loadPostalCodeTopology = function( path, g, topologyInfo, vaccination, postalCodes  ) {
  var self = this ;
  var d3 = self.d3 ;
  
  var targetedPostalCodeBoundaries = topologyInfo.targetedPostalCodeBoundaries ;
  var c = topologyInfo.center ;
  var focusedPostalCodeBoundaries = topologyInfo.focusedPostalCodeBoundaries ;
  var focusedPostalCodes = topologyInfo.focusedPostalCodes ;
  
  g.selectAll("path")
    .data(focusedPostalCodeBoundaries, function(d) { return d.properties.zip ; })
  .enter()
    .append("path")
    .attr("d", path)
    .attr("id", function(d) { return "v-" + vaccination + "-pc-" + d.properties.zip } )
    .classed("postal-code",true)
    .classed("target",function(d) { return postalCodes.indexOf(d.properties.zip) >= 0 ; } )
    .append( "title" )
      .text(function(d) { return d.properties.zip ; } )
    ;

  return { center: c, focusedPostalCodes: focusedPostalCodes } ;
};

