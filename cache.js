var
  fs = require('fs')
  ;

var Cache = function Cache( location ) {
  this.location = location ;
} ;

Cache.prototype.list = function( callback  ) {
  fs.readdir( this.location, function(err,filenames) {
    callback( filenames ) ;
  }) ;
} ;

Cache.prototype.clear = function( name, callback  ) {
  var path = this.location + '/' + name ;
  fs.unlink( path, function(err) {
    console.log("dropped",path,"from the cache") ;
    callback() ;
  } ) ;
} ;

Cache.prototype.load = function( name, producer, callback  ) {
  var path = this.location + '/' + name ;
  if ( fs.existsSync(path) ) {
    console.log('reading', path, 'from cache ...') ;
    // already exists, callback with data
    fs.readFile( path, function(err,rawData) {
      var data = rawData.toString() ;
      if ( /.js$/.exec(name) )
        data = JSON.parse(rawData) ;
      callback(err,data) ;
    } ) ;
    return ;
    
  } else if ( !producer ) {
    
    callback("file does not exist and no producer specified",undefined) ;
    return ;
    
  } else {
    producer( function(err,data) {

      if ( typeof data == 'undefined' || data == null ) {
        callback("file does not exist and no data produced",data) ;
        return ;
      }

      console.log('writing', path, 'to cache ...') ;
      var rawData = data ;
      if ( /.js$/.exec(name) )
        rawData = JSON.stringify(rawData);
      fs.writeFile( path, rawData, function(err) {
        callback(err,data) ;
      } ) ;

    }) ;
  }
} ;

module.exports = new Cache('./.data') ;