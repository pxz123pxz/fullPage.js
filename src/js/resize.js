import * as utils from './common/utils.js';
import { getOptions, getContainer } from './common/options.js';
import { updateState } from './stateUpdates.js';
import { getState, state, setState } from './common/state.js';
import { responsive } from './responsive.js';
import { isTouchDevice, FP, isTouch }  from './common/constants.js';
import { landscapeScroll } from './slides/landscapeScroll.js';
import { scrollOverflowHandler } from './scrolloverflow.js';
import { 
    SLIDES_WRAPPER_SEL,
    DESTROYED
} from './common/selectors.js';
import { EventEmitter } from './common/eventEmitter.js';
import { silentMoveTo } from './scroll/silentMove.js';

let previousHeight = utils.getWindowHeight();
let windowsWidth = utils.getWindowWidth();
let g_resizeId;
let g_isConsecutiveResize = false;
FP.reBuild = reBuild;

EventEmitter.on('bindEvents', bindEvents);

function bindEvents(){
    //when resizing the site, we adjust the heights of the sections, slimScroll...
    utils.windowAddEvent('resize', resizeHandler);
    EventEmitter.on('onDestroy', onDestroy);
}

function onDestroy(){
    clearTimeout(g_resizeId);
    utils.windowRemoveEvent('resize', resizeHandler);
}

/*
* Resize event handler.
*/        
function resizeHandler(){

    if(!g_isConsecutiveResize){
        // what is this for??!!
        if(getOptions().autoScrolling && !getOptions().scrollBar || !getOptions().fitToSection){
            setSectionsHeight(utils.getWindowHeight());
        }
    }

    g_isConsecutiveResize = true;

    //in order to call the functions only when the resize is finished
    //http://stackoverflow.com/questions/4298612/jquery-how-to-call-resize-event-only-once-its-finished-resizing    
    clearTimeout(g_resizeId);
    g_resizeId = setTimeout(function(){

        //issue #3336 
        //(some apps or browsers, like Chrome/Firefox for Mobile take time to report the real height)
        //so we check it 3 times with intervals in that case
        // for(var i = 0; i< 4; i++){
            resizeActions();
            g_isConsecutiveResize = false;
        // }
    }, 400);
}


/**
* When resizing the site, we adjust the heights of the sections, slimScroll...
*/
function resizeActions(){
    setState({isResizing: true});

    setSectionsHeight('');

    if(getOptions().fitToSection && !getOptions().autoScrolling && !state.isBeyondFullpage){
        setVhUnits();
    }

    EventEmitter.emit('contentChanged');
    updateState();

    //checking if it needs to get responsive
    responsive();

    // rebuild immediately on touch devices
    if (isTouchDevice) {
        var activeElement = document.activeElement;

        //if the keyboard is NOT visible
        if (!utils.matches(activeElement, 'textarea') && !utils.matches(activeElement, 'input') && !utils.matches(activeElement, 'select')) {
            var currentHeight = utils.getWindowHeight();

            //making sure the change in the viewport size is enough to force a rebuild. (20 % of the window to avoid problems when hidding scroll bars)
            if( Math.abs(currentHeight - previousHeight) > (20 * Math.max(previousHeight, currentHeight) / 100) ){
                reBuild(true);
                previousHeight = currentHeight;
            }
        }
    }
    else{
        adjustToNewViewport();
    }

    setState({isResizing: false});
}

/**
 * When resizing is finished, we adjust the slides sizes and positions
 */
function reBuild(resizing){
    if(utils.hasClass(getContainer(), DESTROYED)){ return; }  //nothing to do if the plugin was destroyed

    setState({isResizing: true});

    //updating global vars
    setState({windowsHeight: utils.getWindowHeight()});
    setState({windowsWidth: utils.getWindowWidth()});

    var sections = getState().sections;
    for (var i = 0; i < sections.length; ++i) {
        var section = sections[i];
        var slidesWrap = utils.$(SLIDES_WRAPPER_SEL, section.item)[0];
        var slides = section.slides;

        //adjusting the position fo the FULL WIDTH slides...
        if (slides.length > 1) {
            landscapeScroll(slidesWrap, section.activeSlide.item);
        }
    }

    if(getOptions().scrollOverflow){
        scrollOverflowHandler.makeScrollable();
    }

    var sectionIndex = getState().activeSection.index();

    //isn't it the first section?
    if(sectionIndex){
        //adjusting the position for the current section
        silentMoveTo(sectionIndex + 1);
    }

    setState({isResizing: false});

    if(utils.isFunction( getOptions().afterResize ) && resizing){
        getOptions().afterResize.call(getContainer(), window.innerWidth, window.innerHeight);
    }
    if(utils.isFunction( getOptions().afterReBuild ) && !resizing){
        getOptions().afterReBuild.call(getContainer());
    }
}

/**
* Adjusts a section to the viewport if it has changed.
*/
function adjustToNewViewport(){
    var newWindowHeight = utils.getWindowHeight();
    var newWindowWidth = utils.getWindowWidth();

    if(state.windowsHeight !== newWindowHeight || windowsWidth !== newWindowWidth){
        setState({windowsHeight: newWindowHeight});
        windowsWidth = newWindowWidth;
        reBuild(true);
    }
}

function setSectionsHeight(value){
    var propertyValue = value === '' ? '' : value + 'px';
    getState().sections.forEach(function(section){
        utils.css(section.item, {
            'height': propertyValue
        });
    });
}

/**
 * Defining the value in px of a VH unit. (Used for autoScrolling: false)
 * To fix the height issue on mobile devices when using VH units.
 * https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
 */
function setVhUnits(){
    if(!getOptions().autoScrolling || getOptions().scrollBar){
        // First we get the viewport height and we multiple it by 1% to get a value for a vh unit
        let vh = window.innerHeight * 0.01;

        // Then we set the value in the --vh custom property to the root of the document
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }
}