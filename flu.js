// require dependencies
var https = require('https')
    //cache = require('./cache.js')
    ;


var Flu = function Flu() {} ;

Flu.prototype.get = function(url, callback) {
  https.get(url, function(httpResponse) {
    var body = '';
    httpResponse.on('data', function(data) {
      body += data;
    });
    
    httpResponse.on('end', function() {
      callback(JSON.parse(body));
    })
  }) 
  
  
}

Flu.prototype.counties = function( state,  callback ) {
  var queryString = 'https://fluvaccineapi.hhs.gov/api/v2/ids/2016/states/' + state + '/counties.json'
  this.get(queryString, callback)  
}

Flu.prototype.eachZip = function( state, counties, callback) {
  var out = {};
  out.counties = {};
  out.zips = {}
  
  console.log("querying for", counties.length, "counties...")
  this.nextZip( state, counties.slice(), out, callback ) ;
}

Flu.prototype.nextZip = function( state, counties, out, callback) {
  var self = this ;
  
  if ( counties.length == 0 ) {
    callback( out ) ;
    return ;
  }
  
  var nextCounty = counties[0] ;
  counties.splice(0,1) ; // drop counties[0]
  console.log("number of counties remaining: ", counties.length )
  this.get('https://fluvaccineapi.hhs.gov/api/v2/vaccination_rates/2016/states/' + state + '/counties/' + nextCounty + '/zipcodes.json?ethnicity=T&medicare_status=A', 
     function(data) {
        //console.log(data);
        out.counties[data[0].cn] = data;
       for (var i in data) {
         out.zips[data[i].zip] = data[i].percentage;
       }
        self.nextZip( state, counties, out, callback )  ;
    });
}


module.exports = new Flu() ;