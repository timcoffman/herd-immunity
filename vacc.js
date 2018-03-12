// require dependencies
var fs = require('fs')
    ;


var Vaccination = function Vaccination() {} ;

Vaccination.prototype.eachZip = function(stateCode, vaccination, callback) {
  var self = this ;
  
  var path = "./vacc/" + stateCode.toLowerCase() + "/" + vaccination + ".json" ;
  fs.readFile( path, function(err,data) {
    
    if ( err ) {
      callback(err,{}) ;
      return ;
    }
    
    self.mergeZipByCounty( stateCode, JSON.parse(data), callback ) ;
  
  } ) ;
  
} ;

Vaccination.prototype.mergeZipByCounty = function(stateCode, vaccData, callback) {
  var self = this ;
  
  var path = "./vacc/" + stateCode.toLowerCase() + "/county.json" ;

  fs.readFile( path, function(err,data) {
    
    if ( err ) {
      callback(err,{}) ;
      return ;
    }
    
    var zipToCounty = JSON.parse(data) ;
    
    var out = {} ;
    
    for ( var postalCode in zipToCounty ) {
      
      out[postalCode] = 0 ;
      
      for ( var i in zipToCounty[postalCode] ) {
        var countyName = zipToCounty[postalCode][i].county ;
        var alloc = zipToCounty[postalCode][i].alloc ; 
        
        out[postalCode] += vaccData[countyName] * alloc ;
        
      }
      
    }
    
    
    callback( null, out ) ;
    
      
  } ) ;
  
} ;

module.exports = new Vaccination() ;