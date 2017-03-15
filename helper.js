// require dependencies
var xml2js = require('xml2js'),
    xpath = require("xml2js-xpath"),
    https = require('https'),
    url = require('url'),
    crypto = require('crypto'),
    querystring = require('querystring')
    ;


var Helper = function Helper() {} ;

/*
 * 'authorize' step of EHR-launch flow
 * http://docs.smarthealthit.org/authorization/
 */

Helper.prototype.launch = function( iss, launch, callback ) {
  var self = this ;
  https.get( iss + '/metadata', function(httpResponse) {
    var body = '';
    
    httpResponse.on( 'data', function(data) {
      body += data;
    }) ;

    httpResponse.on( 'end', function() {
      
      xml2js.parseString( body, function(err,conformance) {
        var oauth_uris = xpath.find( conformance, "//extension[@url='http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris']" ) ;
        var authorize_uri = xpath.find( oauth_uris, "//extension[@url='authorize']//valueUri" )[0]['$'].value ;
        var token_uri = xpath.find( oauth_uris, "//extension[@url='token']//valueUri" )[0]['$'].value ;
        
        self.authorize( iss, authorize_uri, token_uri, launch, callback ) ;
      }) ;
    })
    
  })
  .on( 'error', callback )
  ;
  
};


/*
 * 'authorize' step of EHR-launch flow
 * http://docs.smarthealthit.org/authorization/
 */
Helper.prototype.authorize = function( iss, authorize_uri, token_uri, launch, callback ) {
  var self = this ;
  var state = crypto.randomBytes(16).toString('hex') ;
  var authorizeUrl = url.parse(authorize_uri) ;
  var query = {
    response_type: 'code',
    client_id: process.env.CLIENT_ID_NONPROD,
    redirect_uri: url.resolve(process.env.APP_URL,'auth'),
    launch: launch,
    scope: 'launch online_access launch/patient patient/*.read openid profile',
    state: state,
    aud: iss
  } ;
  var authPath = authorizeUrl.path + '?' + querystring.stringify(query);
  https.get( { host: authorizeUrl.host, path: authPath }, function(httpResponse) {

    
    if ( 300 <= httpResponse.statusCode && httpResponse.statusCode < 400 ) {
      
      var location = httpResponse.headers.location ;
      var locationUrl = url.parse( location ) ;
      var queryValues = querystring.parse(locationUrl.query);
      
      var authorizationCode = queryValues.code; 
      var stateEcho = queryValues.state;
           
      if ( stateEcho == state ) {
        
        self.token( authorizationCode, state, token_uri, callback ) ;
        
      } else {
        callback( "expected state \"" + state + "\", got \"" + stateEcho + "\"" ) ;
      }
      
    } else {

      callback( "expected a redirect, got " + httpResponse.statusCode ) ;

    }
    
  })
  .on( 'error', callback );
} ;

/*
 * 'token' step of EHR-launch flow
 * http://docs.smarthealthit.org/authorization/
 */
Helper.prototype.token = function( authorizationCode, state, token_uri, callback ) {
  var self = this ;
  
  var tokenUrl = url.parse(token_uri) ;
  
  var query = {
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: url.resolve(process.env.APP_URL,'auth'),
    client_id: process.env.CLIENT_ID_NONPROD,
  } ;
  
  var postData = querystring.stringify( query ) ;
  // console.log( "process.env.CLIENT_ID_NONPROD + \":\" + process.env.CLIENT_SECRET: ", process.env.CLIENT_ID_NONPROD + ":" + process.env.CLIENT_SECRET ) ;
  var postHeaders = {
    //'Authorization': 'Basic ' + new Buffer( process.env.CLIENT_ID_NONPROD + ":" + process.env.CLIENT_SECRET ).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  } ;
  
  var postRequest = https.request( { method: "POST", host: tokenUrl.host, path: tokenUrl.path, headers: postHeaders }, function(httpResponse) {

    var body = '';
    httpResponse.on( 'data', function(data) { body += data; }) ;
    httpResponse.on( 'end', function() {
      var tokenResponse = JSON.parse( body ) ;
      
      if ( tokenResponse.state != state ) {
        
        callback( "expected state \"" + state + "\", got \"" + tokenResponse.state + "\"" ) ;
        
      } else if ( tokenResponse.token_type != 'bearer' ) {
        
        callback( "expected state \"" + 'bearer' + "\", got \"" + tokenResponse.token_type + "\"" ) ;
        
      } else {
        callback( undefined, tokenResponse );
      }
      
    });
    
  }).on( 'error', callback )
  ;
  
  postRequest.write( postData ) ;
  postRequest.end() ;
  ;
};

module.exports = new Helper() ;