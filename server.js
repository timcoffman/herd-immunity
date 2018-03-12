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
    url = require('url'),
    Topology = require('./topo.js'),
    FHIR = require('fhir'),
    helper = require('./helper.js'),
    Patient = require('./patient.js'),
    Flu = require('./flu.js'),
    Vaccination = require('./vacc.js'),
    cache = require('./cache.js'),
    dateformat = require('dateformat')
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

// app.use( function(request,response,chain) {
//   var origin = request.get('origin') ; // TODO: fix this
//   // console.log( "origin:", origin ) ;
//   // console.log( "headers:", request.headers ) ;
//   response.locals.request_origin = origin ;
//   chain() ;
// }) ;

// root
app.get('/', function(request,response) {
  response.render('index'); 
});

var VACC_CONFIG = {
    'flu': { title: 'Influenza', orderKey: 'VUMCIMMFLU' },
    'hpv': { title: 'HPV', orderKey: 36208 },
    'tdap': { title: 'TDAP' },
    'zoster': { title: 'Zoster'},
    'ppsv23': { title: 'PPSV23', orderKey: 'IMM61' },
    'pcv13': { title: 'PCV13', orderKey: 'IMM61' }
    } ;

app.get('/fhir', function(request, response) {
  var iss = request.query.iss ;
  var launch = request.query.launch ;
  var origin = url.parse(request.headers.referer).host ;
  response.locals.request_origin = origin ;
  console.log( "origin:", origin ) ;
  
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
           // console.log( "patientResource: ", patientResource ) ;
          var demographics = {
            familyName: xpath.find(patientResource,'//name//family'),
            givenName: xpath.find(patientResource,'//name//given'),
            //a[bb/text() = "zz"]/cc/text()
            phoneNumber: xpath.find(patientResource,'//telecom[system/text() = "phone"]/value/text()'),
            birthDate: patientResource.birthDate
          }

          var postalCodes = xpath.find( patientResource, '//address/postalCode' ) ;

          patient.immunizations( function(err, immunizationResources) {

          if ( err ) {

            console.log( "error: ", err ) ;
            response.render('index', { backUrl: request.url } ); 
          
          } else {

            // console.log( "immunizationResources: ", immunizationResources ) ;
            
            var vaccinations = { } ;
            for ( var vaccination in VACC_CONFIG ) {
              
              var vacc = vaccinations[vaccination] = { } ;
              vacc.title = VACC_CONFIG[vaccination].title ;
              vacc.orderKey = VACC_CONFIG[vaccination].orderKey ;
              console.log( "vacc:", vacc ) ;
              var imms = immunizationResources.filter( function(i) { return i.vaccineCode && i.vaccineCode.text.toLowerCase() == vaccination ; } ) ;
              if ( imms.length ) {
                
                vacc.immunization = {
                  whenGiven: imms.map( function(i) { 
                    var given = new Date(i.date);
                    return dateformat(given, 'mm/dd/yyyy') ; 
                  }).join( " , ")
                } ;
                
              }
            }

            console.log( 'vaccinations', vaccinations ) ;
            
            var model = {
              patient: demographics,
              suppress_patient_banner: 'false' == responseToken.need_patient_banner,
              smart_style_url: responseToken.smart_style_url,
              postalCodes: postalCodes,
              immunizations: immunizationResources,
              vaccinations: vaccinations
            } ;
            
            response.render('coverage', model );
            
          }
            
        });
          
        }
        
      }) ;
      

    }
  } ) ;
  
});

app.get('/smart.css', function(request, response) {
  
  helper.smartStyle( request.query.url, function( err, style ) {
    
    if ( err ) {
      console.log( err ) ;
      response.status(400).send() ;
    } else {
      
      response.setHeader( "Content-Type", 'text/css' ) ;
      response.render('smartcss', { layout: false, url: request.query.url, style: style }  ) ;
      
    }
    
  } );
  
});

app.get('/coverage', function(request, response) {
  var postalCodes = request.query.postalCodes.split(",") ;
  
  var vaccinations = { } ;
  for ( var vaccination in VACC_CONFIG ) {
    var vacc = vaccinations[vaccination] = { } ;
    vacc.title = VACC_CONFIG[vaccination].title ;
  }

  var demographics = {
    familyName: "Smith",
    givenName: "Jane",
    phoneNumber: '000-555-1212',
    birthDate: '1/1/1980'
  }
  
  console.log( 'vaccinations', vaccinations ) ;

  var model = {
    patient: demographics,
    //smart_style_url: 'https://ic-fhirworks.epic.com/interconnect-fhir-open/api/epic/2016/EDI/HTTP/style/100013/I0YyRkFGOHwjQzEyMTI3fCMwMEFBRkZ8I0UwRjNFRXwjODZCNTQwfCMwMDAwMDB8MHB4fDEwcHh8fEFyaWFsLCBzYW5zLXNlcmlmfCdTZWdvZSBVSScsIEFyaWFsLCBzYW5zLXNlcmlmfHw=.json',
    postalCodes: postalCodes,
    immunizations: [],
    vaccinations: vaccinations
  } ;
  
  response.render( 'coverage', model ) ;
});

app.get('/vaccination/:state/flu', function(request, response) {
  var focusedPostalCodes = request.query.postalCodes.split(/,/) ;
  
  var stateCode = request.params.state;
  cache.load( stateCode.toLowerCase() + ".json", function( callback ) {
    
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
  
});


app.get('/vaccination/:state/:vaccination', function(request, response) {
  var stateCode = request.params.state;
  var focusedPostalCodes = request.query.postalCodes.split(/,/) ;
  var vaccination = request.params.vaccination ;
  
  Vaccination.eachZip( stateCode, vaccination, function(err,out) {
    
    var postalRates = {} ;
    focusedPostalCodes.forEach( function(postalCode){
      postalRates[postalCode] = out[postalCode] ;
    });

    response.send( postalRates ) ;
  
  });
}) ;

/*
 * called by Hyperspace "criteria bpa" to decide
 *   if the "base bpa" should be shown at all
 *   and what the text should be (when it is shown)
 */
app.post('/bpa_criteria_endpoint', function(request,response) {
  var cda = request.body.ProcessDocument.Document[0].ClinicalDocument[0] ;
  
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


app.get('/topology/postal-code/:postalCode', function(request,response) {
  var postalCode = request.params.postalCode ;
  
  var etag = "postal-code-" + postalCode ;
  
  if ( request.headers['if-none-match'] == etag ) { console.log('request.headers[\'if-none-match\']',request.headers['if-none-match']) ; response.status(304).send() ; return ; }
  
  console.info( "getting postal-code topology..." ); 
  Topology.get( 'zips_us_topo.json', 'https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fzips_us_topo.json?1489526002367', function(err,topology) {
    if ( err ) {
      console.log( err ) ;
      response.status(400).send( err ) ;
    } else {
      Topology.focusedPostalCodes( topology, [postalCode], function(err,data) {
        
        if ( err ) {
          console.log( err ) ;
          response.status(400).send( err ) ;
        } else {
          response.setHeader('Cache-Control', 'public, max-age=86400') ;
          response.setHeader('ETag', etag) ;
          response.status(200).send( data ) ;
        }
        
      } ) ;
    }
  }) ;
  
}) ;

app.get('/topology/county', function(request,response) {
  var center = [ request.query.cx, request.query.cy ] ;
  
  var etag = "county-" + center[0] + "-" + center[1] ;
  if ( request.headers['if-none-match'] == etag ) { console.log('request.headers[\'if-none-match\']',request.headers['if-none-match']) ; response.status(304).send() ; return ; }
  
  console.info( "getting postal-code topology..." ); 
  Topology.get( 'us.topo.json', 'https://cdn.glitch.com/b3018506-7e8b-48d7-abf4-2c158dfe960b%2Fus.topo.json?1489524457034', function(err,topology) {
    if ( err ) {
      console.log( err ) ;
      response.status(400).send( err ) ;
    } else {
      Topology.focusedCounties( topology, center, function(err,data) {

      if ( err ) {
        console.log( err ) ;
        response.status(400).send( err ) ;
      } else {
        
        response.setHeader('Cache-Control', 'public, max-age=86400') ;
        response.setHeader('ETag', etag) ;
        response.status(200).send( data ) ;
      }
      }) ;
    }
  }) ;
}) ;

// about
app.get('/about', function(request,response) {
  response.redirect( '/index' ); 
});


app.get('/cache', function(request, response) {
  cache.list( function(files) {
    console.log( "files", files ) ;
    response.render('cache', { files: files } ) ;
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
