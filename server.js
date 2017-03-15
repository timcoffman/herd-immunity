// server.js
// where your node app starts

// require dependencies
var util = require('util'),
    express = require('express'),
    bodyParser = require('body-parser'),
    xml2js = require('xml2js'),
    xpath = require("xml2js-xpath"),
    xmlparser = require('express-xml-bodyparser'),
    exphbs = require('express-handlebars'),
    FHIR = require('fhir'),
    helper = require('./helper.js'),
    Patient = require('./patient.js'),
    Flu = require('./flu.js'),
    cache = require('./cache.js')
    ;
var app = express();

// configure how the body can be transformed
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended:true } ) );
app.use( xmlparser( { attrkey:'_attrs', charkey:'_text', trim:true, normalizeTags:false } ) );

var builder = new xml2js.Builder() ;

// setup view renderer
var hbs = exphbs.create({
  defaultLayout: 'single',
  helpers: {
    toJSON: function(object) { return JSON.stringify(object); }
  }
});

app.engine('handlebars', hbs.engine ) ;
app.set("view engine", "handlebars") ;

// where to find public/static files
app.use(express.static('public'));

// root
app.get('/', function(request,response) {
  response.render('index'); 
});

app.get('/fhir', function(request, response) {
  var iss = request.query.iss ;
  var launch = request.query.launch ;
  
  helper.launch( iss, launch, function( err, responseToken ) {
    if (err) {

      console.log( "error: ", err ) ;
      response.render('index', { backUrl: request.url } );

    } else {
      console.log( "responseToken:", responseToken ) ;
      var patient = new Patient( iss, responseToken.access_token, responseToken.patient );
      
      patient.get( function(err, patientResource) {
        
        if ( err ) {
          
          console.log( "error: ", err ) ;
          response.render('index', { backUrl: request.url } ); 
          
        } else {
          var postalCodes = xpath.find( patientResource, '//address/postalCode' ) ;

          patient.immunizations( function(err, immunizationResources) {

          if ( err ) {

            console.log( "error: ", err ) ;
            response.render('index', { backUrl: request.url } ); 
          
          } else {

            console.log( "immunizationResources: ", immunizationResources ) ;

            response.render('coverage', { smart_style_url: responseToken.smart_style_url, postalCodes: postalCodes, immunizations: immunizationResources } );
            
          }
            
        });
          
        }
        
      }) ;
      

    }
  } ) ;
  
});


app.get('/flu', function(request, response) {
  var focusedPostalCodes = request.query.postalCodes.split(/,/) ;
  
  var stateCode = 'WI';
  cache.load( stateCode.toLowerCase() + ".js", function( callback ) {
    
    Flu.counties( stateCode, function(counties) {
      Flu.eachZip(stateCode, counties, function( out ){
        callback(null,out) ;
      });
    });
    
  }, function(err,data) {
    
    var postalRates = {};
    
    for (var i in focusedPostalCodes) {
      postalRates[focusedPostalCodes[i]] = data.zips[focusedPostalCodes[i]];
    }
    
    response.send( postalRates );    
  }) ;
  
})

/*
 * called by Hyperspace "criteria bpa" to decide
 *   if the "base bpa" should be shown at all
 *   and what the text should be (when it is shown)
 */
app.post('/bpa_criteria_endpoint', function(request,response) {
  var cda = request.body.ProcessDocument.Document[0].ClinicalDocument[0] ;
  //console.log( util.inspect(cda,{depth:17}) ) ;
  
  var user = xpath.find(cda,'/component/structuredBody/component/section//div//item')[0].content[0] ;

  var postalCodes = xpath.find(cda,'//patientRole//addr//postalCode') ;
  var patientName = xpath.find(cda,'//patientRole//patient//name')[0] ;
  var patientDisplayName = patientName.family + ", " + patientName.given
  
  var currentUserBelongsToVUMC = user.indexOf( 'VUMC' ) >= 0 ;
  var postalCodesAvailable = postalCodes.length != 0 ;
  var shouldShowAlert = postalCodesAvailable && currentUserBelongsToVUMC  ;
  
  var displayText ;
  if ( shouldShowAlert ) {
    displayText = 'Detailed immunization coverage data is available for <strong>' + patientDisplayName + '</strong>\'s home and/or work area (postal code(s) <strong>' +  postalCodes.join(', ') + '</strong>).' ; 
  } else {
    displayText = 'Detailed immunization coverage data is not available for <strong>' + patientDisplayName + '</strong>\'s home and/or work area' ;
  }
  
  /*
   * see https://apporchard.epic.com/Article/IntegratingExternalDecisionSupport
   */
  var xml = builder.buildObject( { CDSAdvisory: {
    ShowAlert: shouldShowAlert,
    DisplayText: displayText,
      AcknowledgementReasons: {
      RequireReasonWhenNoAction: false,
      RequireCommentWithReason: false,
      
    }
  } } ) ;
  
  response.status(200).send( xml ); 
});

// about
app.get('/about', function(request,response) {
  response.redirect( '/index' ); 
});


app.get('/cache', function(request, response) {
  cache.list( function(filenames) {
    console.log( "filenames", filenames ) ;
    response.render('cache', { filenames: filenames } ) ;
  }) ;
});

app.get('/cache/:filename', function(request, response) {
  cache.load( request.params.filename, function() { console.log("no such file") ; return undefined ; }, function(err,data) {
    if ( err )
      response.status(400).send( data ) ;
    else
      response.status(200).send( data ) ;
  } ) ;
});

app.post('/cache/drop', function(request, response) {
  cache.clear( request.query.filename, function() {
    response.redirect('/cache') ;
  }) ;
});


// catch all others
app.get('/:view', function(request,response) {
  var viewName = request.params.view ;
  var data = {} ; // extract plain query values, interpreting as JSON as necessary
  for ( var n in request.query ) {
    var value = request.query[n] ;
    if ( /^[[{'"}]/.exec(value) )
      value = JSON.parse(value) ;
    data[n] = value ;
  }
  console.log( "rendering view: ", viewName, "with query: ", data ) ;
  response.render( viewName, data ); 
});


// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
