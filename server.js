// server.js
// where your node app starts

// require dependencies
var util = require('util'),
    express = require('express'),
    bodyParser = require('body-parser'),
    xml2js = require('xml2js'),
    xpath = require("xml2js-xpath"),
    xmlparser = require('express-xml-bodyparser'),
    exphbs = require('express-handlebars')
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

app.post('/coverage', function(request, response) {
  response.render('coverage')
})

/*
 * called by Hyperspace "criteria bpa" to decide
 *   if the "base bpa" should be shown at all
 *   and what the text should be (when it is shown)
 */
app.post('/bpa_criteria_endpoint', function(request,response) {
  var cda = request.body.ProcessDocument.Document[0].ClinicalDocument[0] ;
  // console.log( util.inspect(cda,{depth:3}) ) ;
  
  var user = xpath.find(cda,'/component/structuredBody/component/section//div//item')[0].content[0] ;
  // var components = xpath.find( cda, '/component' ) ;
  // var sections = xpath.find( components[0], '/structuredBody/component/section' ) ;
  // var user = xpath.find( sections[0], '//div[caption="Session-Level Information"]//item[caption="Login User Name"]/content' ) ;
  // var user = xpath.find( cda, '/component/structuredBody/component/section//div[caption="Session-Level Information"]//item[caption="Login User Name"]/content' ) ;
  // console.log( "components: " + components ) ;
  // console.log( "sections: " + sections ) ;
  // console.log( "user: " + user ) ;
  
  var shouldShowAlert = user.indexOf( 'VUMC' ) >= 0 ;
  var patientName = "Name, Patient"
  
  /*
   * see https://apporchard.epic.com/Article/IntegratingExternalDecisionSupport
   */
  var xml = builder.buildObject( { CDSAdvisory: {
    ShowAlert: shouldShowAlert,
    DisplayText: 'Detailed immunization coverage data is available for ' + patientName + '\'s home and/or work area.',
      AcknowledgementReasons: {
      RequireReasonWhenNoAction: false,
      RequireCommentWithReason: false,
      
    }
  } } ) ;
  console.log( xml );
  response.status(200).send( xml ); 
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
