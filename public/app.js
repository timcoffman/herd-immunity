var selfOrigin = location.origin ;
var anyOrigin = "*" ;
var requestOrigin = 'http://' + window.REQUEST_ORIGIN ; 
var allowedOrigin = requestOrigin ; 

function aglDebug() {
  for ( var i in arguments ) {
    console.log( arguments[i] ) ;
    var text = arguments[i] ;
    if ( typeof text == 'object' )
      text = JSON.stringify(arguments[i]) ;
    $('<div class="error">' + text + '</div>')
      .appendTo( $('#debugger' ) )
    ;
  }
  
}

function appStartup() {
  $( document ).ready( function() {

    window.addEventListener("message", aglListener, false);
  	aglPost(HANDSHAKE,null) ;

    $( "body" ).on( "click", "button.place-order", function() {
      var vaccination = $( this ).attr('data-vaccination') ;
      var orderKey = $( this ).attr('data-order-key') ;
      placeVaccinationOrder( vaccination, orderKey );
    });
    
  }) ;

}

function placeVaccinationOrder(vaccination, orderKey) {
  
  var orderDetails = {
    OrderKey: orderKey,
    OrderMode: "IP"
  } ;
  
  aglPost(POST_ORDER,orderDetails) ;
  
}

var HANDSHAKE = "Epic.Clinical.Informatics.Web.InitiateHandshake" ;
var CLOSE_ACTIVITY = "Epic.Clinical.Informatics.Web.CloseActivity" ;
var SAVE_STATE = "Epic.Clinical.Informatics.Web.SaveState" ;
var POST_ORDER = "Epic.Clinical.Informatics.Web.PostOrder" ;
var POST_FLOWSHEET_ROW = "Epic.Clinical.Informatics.Web.PostFlowsheetRow" ;
var OPEN_WINDOW = "Epic.Clinical.Informatics.Web.OpenWindow" ;


var gCurrentRequest = null ;
var gToken = null ;

function aglPost(action, args) {
  
  gCurrentRequest = {
    action: action,
    args: args,
    status: 'pending',
    eventCount: 0
  };
	
  $('#progress').show() ;

  window.setTimeout( function() {
    
    aglDebug( { action: action, token: gToken, args: args } );
    
    try {
      
      window.parent.postMessage({
        action: gCurrentRequest.action,
        token: gToken,
        args: gCurrentRequest.args
      },allowedOrigin);

    } catch (ex)  {
      
      $('#progress').hide() ;
      aglDebug( ex ) ;
      
    }
    
    
  }, 0 );
  
  return gCurrentRequest ;
}


function aglListener(evt) {
  
  if ( !gCurrentRequest.eventCount )
		aglDebug( "Origin:", evt.origin ) ;
  ++gCurrentRequest.eventCount ;

	for ( var type in evt.data ) {
		var contents = evt.data[type] ;
		if ( "token" == type ) {
			
			gToken = contents ;
			aglDebug( "token", gToken ) ;
			
		} else if ( "features" == type ) {
			
      if ( contents.indexOf(POST_ORDER) >= 0 )
        $('button.place-order').show() ;
      
			// for ( var action in contents ) {
			// aglDebug("Feature", contents[action] ) ;
			// }

		} else if ( "actionExecuted" == type ) {
      
      gCurrentRequest.status = contents ? 'complete' : 'incomplete' ;
      $('#progress').hide() ;
      
		} else if ( "state" == type ) {
        
      if ( contents )
        aglDebug( "State:", contents ) ;
      
		} else if ( "error" == type ) {
      
      for ( var k in contents ) {
        $('<div class="error">' + JSON.stringify(contents[k]) + '</div>')
          .appendTo( $('#error-container' ) )
          ;
    }

		} else {
      
      aglDebug( "Other (" + type + "):", contents ) ;
			
		}
		
	}
}