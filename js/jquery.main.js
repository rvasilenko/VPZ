jQuery(function() {
    initLightbox();
    initSlideshow();
});

// fancybox init
function initLightbox() {
    jQuery('a.fancybox').fancybox();
}

// slideshow init
function initSlideshow() {
    jQuery('.media-list .item').each(function() {
        var container = jQuery(this);
        container.find('.slideshow').cycle({
            fx: 'scrollLeft',
            timeout: 0,
            speed: 500,
            next: container.find('a.btn-more')
        });
    });

}

/*!
 * jQuery Cycle Plugin (with Transition Definitions)
 * Examples and documentation at: http://jquery.malsup.com/cycle/
 * Copyright (c) 2007-2013 M. Alsup
 * Version: 3.0.3 (11-JUL-2013)
 * Dual licensed under the MIT and GPL licenses.
 * http://jquery.malsup.com/license.html
 * Requires: jQuery v1.7.1 or later
 */
;(function($, undefined) {
    "use strict";

    var ver = '3.0.3';

    function debug(s) {
        if ($.fn.cycle.debug)
            log(s);
    }
    function log() {
        /*global console */
        if (window.console && console.log)
            console.log('[cycle] ' + Array.prototype.join.call(arguments,' '));
    }
    $.expr[':'].paused = function(el) {
        return el.cyclePause;
    };


// the options arg can be...
//   a number  - indicates an immediate transition should occur to the given slide index
//   a string  - 'pause', 'resume', 'toggle', 'next', 'prev', 'stop', 'destroy' or the name of a transition effect (ie, 'fade', 'zoom', etc)
//   an object - properties to control the slideshow
//
// the arg2 arg can be...
//   the name of an fx (only used in conjunction with a numeric value for 'options')
//   the value true (only used in first arg == 'resume') and indicates
//	 that the resume should occur immediately (not wait for next timeout)

    $.fn.cycle = function(options, arg2) {
        var o = { s: this.selector, c: this.context };

        // in 1.3+ we can fix mistakes with the ready state
        if (this.length === 0 && options != 'stop') {
            if (!$.isReady && o.s) {
                log('DOM not ready, queuing slideshow');
                $(function() {
                    $(o.s,o.c).cycle(options,arg2);
                });
                return this;
            }
            // is your DOM ready?  http://docs.jquery.com/Tutorials:Introducing_$(document).ready()
            log('terminating; zero elements found by selector' + ($.isReady ? '' : ' (DOM not ready)'));
            return this;
        }

        // iterate the matched nodeset
        return this.each(function() {
            var opts = handleArguments(this, options, arg2);
            if (opts === false)
                return;

            opts.updateActivePagerLink = opts.updateActivePagerLink || $.fn.cycle.updateActivePagerLink;

            // stop existing slideshow for this container (if there is one)
            if (this.cycleTimeout)
                clearTimeout(this.cycleTimeout);
            this.cycleTimeout = this.cyclePause = 0;
            this.cycleStop = 0; // issue #108

            var $cont = $(this);
            var $slides = opts.slideExpr ? $(opts.slideExpr, this) : $cont.children();
            var els = $slides.get();

            if (els.length < 2) {
                log('terminating; too few slides: ' + els.length);
                return;
            }

            var opts2 = buildOptions($cont, $slides, els, opts, o);
            if (opts2 === false)
                return;

            var startTime = opts2.continuous ? 10 : getTimeout(els[opts2.currSlide], els[opts2.nextSlide], opts2, !opts2.backwards);

            // if it's an auto slideshow, kick it off
            if (startTime) {
                startTime += (opts2.delay || 0);
                if (startTime < 10)
                    startTime = 10;
                debug('first timeout: ' + startTime);
                this.cycleTimeout = setTimeout(function(){go(els,opts2,0,!opts.backwards);}, startTime);
            }
        });
    };

    function triggerPause(cont, byHover, onPager) {
        var opts = $(cont).data('cycle.opts');
        if (!opts)
            return;
        var paused = !!cont.cyclePause;
        if (paused && opts.paused)
            opts.paused(cont, opts, byHover, onPager);
        else if (!paused && opts.resumed)
            opts.resumed(cont, opts, byHover, onPager);
    }

// process the args that were passed to the plugin fn
    function handleArguments(cont, options, arg2) {
        if (cont.cycleStop === undefined)
            cont.cycleStop = 0;
        if (options === undefined || options === null)
            options = {};
        if (options.constructor == String) {
            switch(options) {
                case 'destroy':
                case 'stop':
                    var opts = $(cont).data('cycle.opts');
                    if (!opts)
                        return false;
                    cont.cycleStop++; // callbacks look for change
                    if (cont.cycleTimeout)
                        clearTimeout(cont.cycleTimeout);
                    cont.cycleTimeout = 0;
                    if (opts.elements)
                        $(opts.elements).stop();
                    $(cont).removeData('cycle.opts');
                    if (options == 'destroy')
                        destroy(cont, opts);
                    return false;
                case 'toggle':
                    cont.cyclePause = (cont.cyclePause === 1) ? 0 : 1;
                    checkInstantResume(cont.cyclePause, arg2, cont);
                    triggerPause(cont);
                    return false;
                case 'pause':
                    cont.cyclePause = 1;
                    triggerPause(cont);
                    return false;
                case 'resume':
                    cont.cyclePause = 0;
                    checkInstantResume(false, arg2, cont);
                    triggerPause(cont);
                    return false;
                case 'prev':
                case 'next':
                    opts = $(cont).data('cycle.opts');
                    if (!opts) {
                        log('options not found, "prev/next" ignored');
                        return false;
                    }
                    if (typeof arg2 == 'string')
                        opts.oneTimeFx = arg2;
                    $.fn.cycle[options](opts);
                    return false;
                default:
                    options = { fx: options };
            }
            return options;
        }
        else if (options.constructor == Number) {
            // go to the requested slide
            var num = options;
            options = $(cont).data('cycle.opts');
            if (!options) {
                log('options not found, can not advance slide');
                return false;
            }
            if (num < 0 || num >= options.elements.length) {
                log('invalid slide index: ' + num);
                return false;
            }
            options.nextSlide = num;
            if (cont.cycleTimeout) {
                clearTimeout(cont.cycleTimeout);
                cont.cycleTimeout = 0;
            }
            if (typeof arg2 == 'string')
                options.oneTimeFx = arg2;
            go(options.elements, options, 1, num >= options.currSlide);
            return false;
        }
        return options;

        function checkInstantResume(isPaused, arg2, cont) {
            if (!isPaused && arg2 === true) { // resume now!
                var options = $(cont).data('cycle.opts');
                if (!options) {
                    log('options not found, can not resume');
                    return false;
                }
                if (cont.cycleTimeout) {
                    clearTimeout(cont.cycleTimeout);
                    cont.cycleTimeout = 0;
                }
                go(options.elements, options, 1, !options.backwards);
            }
        }
    }

    function removeFilter(el, opts) {
        if (!$.support.opacity && opts.cleartype && el.style.filter) {
            try { el.style.removeAttribute('filter'); }
            catch(smother) {} // handle old opera versions
        }
    }

// unbind event handlers
    function destroy(cont, opts) {
        if (opts.next)
            $(opts.next).unbind(opts.prevNextEvent);
        if (opts.prev)
            $(opts.prev).unbind(opts.prevNextEvent);

        if (opts.pager || opts.pagerAnchorBuilder)
            $.each(opts.pagerAnchors || [], function() {
                this.unbind().remove();
            });
        opts.pagerAnchors = null;
        $(cont).unbind('mouseenter.cycle mouseleave.cycle');
        if (opts.destroy) // callback
            opts.destroy(opts);
    }

// one-time initialization
    function buildOptions($cont, $slides, els, options, o) {
        var startingSlideSpecified;
        // support metadata plugin (v1.0 and v2.0)
        var opts = $.extend({}, $.fn.cycle.defaults, options || {}, $.metadata ? $cont.metadata() : $.meta ? $cont.data() : {});
        var meta = $.isFunction($cont.data) ? $cont.data(opts.metaAttr) : null;
        if (meta)
            opts = $.extend(opts, meta);
        if (opts.autostop)
            opts.countdown = opts.autostopCount || els.length;

        var cont = $cont[0];
        $cont.data('cycle.opts', opts);
        opts.$cont = $cont;
        opts.stopCount = cont.cycleStop;
        opts.elements = els;
        opts.before = opts.before ? [opts.before] : [];
        opts.after = opts.after ? [opts.after] : [];

        // push some after callbacks
        if (!$.support.opacity && opts.cleartype)
            opts.after.push(function() { removeFilter(this, opts); });
        if (opts.continuous)
            opts.after.push(function() { go(els,opts,0,!opts.backwards); });

        saveOriginalOpts(opts);

        // clearType corrections
        if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
            clearTypeFix($slides);

        // container requires non-static position so that slides can be position within
        if ($cont.css('position') == 'static')
            $cont.css('position', 'relative');
        if (opts.width)
            $cont.width(opts.width);
        if (opts.height && opts.height != 'auto')
            $cont.height(opts.height);

        if (opts.startingSlide !== undefined) {
            opts.startingSlide = parseInt(opts.startingSlide,10);
            if (opts.startingSlide >= els.length || opts.startSlide < 0)
                opts.startingSlide = 0; // catch bogus input
            else
                startingSlideSpecified = true;
        }
        else if (opts.backwards)
            opts.startingSlide = els.length - 1;
        else
            opts.startingSlide = 0;

        // if random, mix up the slide array
        if (opts.random) {
            opts.randomMap = [];
            for (var i = 0; i < els.length; i++)
                opts.randomMap.push(i);
            opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
            if (startingSlideSpecified) {
                // try to find the specified starting slide and if found set start slide index in the map accordingly
                for ( var cnt = 0; cnt < els.length; cnt++ ) {
                    if ( opts.startingSlide == opts.randomMap[cnt] ) {
                        opts.randomIndex = cnt;
                    }
                }
            }
            else {
                opts.randomIndex = 1;
                opts.startingSlide = opts.randomMap[1];
            }
        }
        else if (opts.startingSlide >= els.length)
            opts.startingSlide = 0; // catch bogus input
        opts.currSlide = opts.startingSlide || 0;
        var first = opts.startingSlide;

        // set position and zIndex on all the slides
        $slides.css({position: 'absolute', top:0, left:0}).hide().each(function(i) {
            var z;
            if (opts.backwards)
                z = first ? i <= first ? els.length + (i-first) : first-i : els.length-i;
            else
                z = first ? i >= first ? els.length - (i-first) : first-i : els.length-i;
            $(this).css('z-index', z);
        });

        // make sure first slide is visible
        $(els[first]).css('opacity',1).show(); // opacity bit needed to handle restart use case
        removeFilter(els[first], opts);

        // stretch slides
        if (opts.fit) {
            if (!opts.aspect) {
                if (opts.width)
                    $slides.width(opts.width);
                if (opts.height && opts.height != 'auto')
                    $slides.height(opts.height);
            } else {
                $slides.each(function(){
                    var $slide = $(this);
                    var ratio = (opts.aspect === true) ? $slide.width()/$slide.height() : opts.aspect;
                    if( opts.width && $slide.width() != opts.width ) {
                        $slide.width( opts.width );
                        $slide.height( opts.width / ratio );
                    }

                    if( opts.height && $slide.height() < opts.height ) {
                        $slide.height( opts.height );
                        $slide.width( opts.height * ratio );
                    }
                });
            }
        }

        if (opts.center && ((!opts.fit) || opts.aspect)) {
            $slides.each(function(){
                var $slide = $(this);
                $slide.css({
                    "margin-left": opts.width ?
                        ((opts.width - $slide.width()) / 2) + "px" :
                        0,
                    "margin-top": opts.height ?
                        ((opts.height - $slide.height()) / 2) + "px" :
                        0
                });
            });
        }

        if (opts.center && !opts.fit && !opts.slideResize) {
            $slides.each(function(){
                var $slide = $(this);
                $slide.css({
                    "margin-left": opts.width ? ((opts.width - $slide.width()) / 2) + "px" : 0,
                    "margin-top": opts.height ? ((opts.height - $slide.height()) / 2) + "px" : 0
                });
            });
        }

        // stretch container
        var reshape = (opts.containerResize || opts.containerResizeHeight) && $cont.innerHeight() < 1;
        if (reshape) { // do this only if container has no size http://tinyurl.com/da2oa9
            var maxw = 0, maxh = 0;
            for(var j=0; j < els.length; j++) {
                var $e = $(els[j]), e = $e[0], w = $e.outerWidth(), h = $e.outerHeight();
                if (!w) w = e.offsetWidth || e.width || $e.attr('width');
                if (!h) h = e.offsetHeight || e.height || $e.attr('height');
                maxw = w > maxw ? w : maxw;
                maxh = h > maxh ? h : maxh;
            }
            if (opts.containerResize && maxw > 0 && maxh > 0)
                $cont.css({width:maxw+'px',height:maxh+'px'});
            if (opts.containerResizeHeight && maxh > 0)
                $cont.css({height:maxh+'px'});
        }

        var pauseFlag = false;  // https://github.com/malsup/cycle/issues/44
        if (opts.pause)
            $cont.bind('mouseenter.cycle', function(){
                pauseFlag = true;
                this.cyclePause++;
                triggerPause(cont, true);
            }).bind('mouseleave.cycle', function(){
                if (pauseFlag)
                    this.cyclePause--;
                triggerPause(cont, true);
            });

        if (supportMultiTransitions(opts) === false)
            return false;

        // apparently a lot of people use image slideshows without height/width attributes on the images.
        // Cycle 2.50+ requires the sizing info for every slide; this block tries to deal with that.
        var requeue = false;
        options.requeueAttempts = options.requeueAttempts || 0;
        $slides.each(function() {
            // try to get height/width of each slide
            var $el = $(this);
            this.cycleH = (opts.fit && opts.height) ? opts.height : ($el.height() || this.offsetHeight || this.height || $el.attr('height') || 0);
            this.cycleW = (opts.fit && opts.width) ? opts.width : ($el.width() || this.offsetWidth || this.width || $el.attr('width') || 0);

            if ( $el.is('img') ) {
                var loading = (this.cycleH === 0 && this.cycleW === 0 && !this.complete);
                // don't requeue for images that are still loading but have a valid size
                if (loading) {
                    if (o.s && opts.requeueOnImageNotLoaded && ++options.requeueAttempts < 100) { // track retry count so we don't loop forever
                        log(options.requeueAttempts,' - img slide not loaded, requeuing slideshow: ', this.src, this.cycleW, this.cycleH);
                        setTimeout(function() {$(o.s,o.c).cycle(options);}, opts.requeueTimeout);
                        requeue = true;
                        return false; // break each loop
                    }
                    else {
                        log('could not determine size of image: '+this.src, this.cycleW, this.cycleH);
                    }
                }
            }
            return true;
        });

        if (requeue)
            return false;

        opts.cssBefore = opts.cssBefore || {};
        opts.cssAfter = opts.cssAfter || {};
        opts.cssFirst = opts.cssFirst || {};
        opts.animIn = opts.animIn || {};
        opts.animOut = opts.animOut || {};

        $slides.not(':eq('+first+')').css(opts.cssBefore);
        $($slides[first]).css(opts.cssFirst);

        if (opts.timeout) {
            opts.timeout = parseInt(opts.timeout,10);
            // ensure that timeout and speed settings are sane
            if (opts.speed.constructor == String)
                opts.speed = $.fx.speeds[opts.speed] || parseInt(opts.speed,10);
            if (!opts.sync)
                opts.speed = opts.speed / 2;

            var buffer = opts.fx == 'none' ? 0 : opts.fx == 'shuffle' ? 500 : 250;
            while((opts.timeout - opts.speed) < buffer) // sanitize timeout
                opts.timeout += opts.speed;
        }
        if (opts.easing)
            opts.easeIn = opts.easeOut = opts.easing;
        if (!opts.speedIn)
            opts.speedIn = opts.speed;
        if (!opts.speedOut)
            opts.speedOut = opts.speed;

        opts.slideCount = els.length;
        opts.currSlide = opts.lastSlide = first;
        if (opts.random) {
            if (++opts.randomIndex == els.length)
                opts.randomIndex = 0;
            opts.nextSlide = opts.randomMap[opts.randomIndex];
        }
        else if (opts.backwards)
            opts.nextSlide = opts.startingSlide === 0 ? (els.length-1) : opts.startingSlide-1;
        else
            opts.nextSlide = opts.startingSlide >= (els.length-1) ? 0 : opts.startingSlide+1;

        // run transition init fn
        if (!opts.multiFx) {
            var init = $.fn.cycle.transitions[opts.fx];
            if ($.isFunction(init))
                init($cont, $slides, opts);
            else if (opts.fx != 'custom' && !opts.multiFx) {
                log('unknown transition: ' + opts.fx,'; slideshow terminating');
                return false;
            }
        }

        // fire artificial events
        var e0 = $slides[first];
        if (!opts.skipInitializationCallbacks) {
            if (opts.before.length)
                opts.before[0].apply(e0, [e0, e0, opts, true]);
            if (opts.after.length)
                opts.after[0].apply(e0, [e0, e0, opts, true]);
        }
        if (opts.next)
            $(opts.next).bind(opts.prevNextEvent,function(){return advance(opts,1);});
        if (opts.prev)
            $(opts.prev).bind(opts.prevNextEvent,function(){return advance(opts,0);});
        if (opts.pager || opts.pagerAnchorBuilder)
            buildPager(els,opts);

        exposeAddSlide(opts, els);

        return opts;
    }

// save off original opts so we can restore after clearing state
    function saveOriginalOpts(opts) {
        opts.original = { before: [], after: [] };
        opts.original.cssBefore = $.extend({}, opts.cssBefore);
        opts.original.cssAfter  = $.extend({}, opts.cssAfter);
        opts.original.animIn	= $.extend({}, opts.animIn);
        opts.original.animOut   = $.extend({}, opts.animOut);
        $.each(opts.before, function() { opts.original.before.push(this); });
        $.each(opts.after,  function() { opts.original.after.push(this); });
    }

    function supportMultiTransitions(opts) {
        var i, tx, txs = $.fn.cycle.transitions;
        // look for multiple effects
        if (opts.fx.indexOf(',') > 0) {
            opts.multiFx = true;
            opts.fxs = opts.fx.replace(/\s*/g,'').split(',');
            // discard any bogus effect names
            for (i=0; i < opts.fxs.length; i++) {
                var fx = opts.fxs[i];
                tx = txs[fx];
                if (!tx || !txs.hasOwnProperty(fx) || !$.isFunction(tx)) {
                    log('discarding unknown transition: ',fx);
                    opts.fxs.splice(i,1);
                    i--;
                }
            }
            // if we have an empty list then we threw everything away!
            if (!opts.fxs.length) {
                log('No valid transitions named; slideshow terminating.');
                return false;
            }
        }
        else if (opts.fx == 'all') {  // auto-gen the list of transitions
            opts.multiFx = true;
            opts.fxs = [];
            for (var p in txs) {
                if (txs.hasOwnProperty(p)) {
                    tx = txs[p];
                    if (txs.hasOwnProperty(p) && $.isFunction(tx))
                        opts.fxs.push(p);
                }
            }
        }
        if (opts.multiFx && opts.randomizeEffects) {
            // munge the fxs array to make effect selection random
            var r1 = Math.floor(Math.random() * 20) + 30;
            for (i = 0; i < r1; i++) {
                var r2 = Math.floor(Math.random() * opts.fxs.length);
                opts.fxs.push(opts.fxs.splice(r2,1)[0]);
            }
            debug('randomized fx sequence: ',opts.fxs);
        }
        return true;
    }

// provide a mechanism for adding slides after the slideshow has started
    function exposeAddSlide(opts, els) {
        opts.addSlide = function(newSlide, prepend) {
            var $s = $(newSlide), s = $s[0];
            if (!opts.autostopCount)
                opts.countdown++;
            els[prepend?'unshift':'push'](s);
            if (opts.els)
                opts.els[prepend?'unshift':'push'](s); // shuffle needs this
            opts.slideCount = els.length;

            // add the slide to the random map and resort
            if (opts.random) {
                opts.randomMap.push(opts.slideCount-1);
                opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
            }

            $s.css('position','absolute');
            $s[prepend?'prependTo':'appendTo'](opts.$cont);

            if (prepend) {
                opts.currSlide++;
                opts.nextSlide++;
            }

            if (!$.support.opacity && opts.cleartype && !opts.cleartypeNoBg)
                clearTypeFix($s);

            if (opts.fit && opts.width)
                $s.width(opts.width);
            if (opts.fit && opts.height && opts.height != 'auto')
                $s.height(opts.height);
            s.cycleH = (opts.fit && opts.height) ? opts.height : $s.height();
            s.cycleW = (opts.fit && opts.width) ? opts.width : $s.width();

            $s.css(opts.cssBefore);

            if (opts.pager || opts.pagerAnchorBuilder)
                $.fn.cycle.createPagerAnchor(els.length-1, s, $(opts.pager), els, opts);

            if ($.isFunction(opts.onAddSlide))
                opts.onAddSlide($s);
            else
                $s.hide(); // default behavior
        };
    }

// reset internal state; we do this on every pass in order to support multiple effects
    $.fn.cycle.resetState = function(opts, fx) {
        fx = fx || opts.fx;
        opts.before = []; opts.after = [];
        opts.cssBefore = $.extend({}, opts.original.cssBefore);
        opts.cssAfter  = $.extend({}, opts.original.cssAfter);
        opts.animIn	= $.extend({}, opts.original.animIn);
        opts.animOut   = $.extend({}, opts.original.animOut);
        opts.fxFn = null;
        $.each(opts.original.before, function() { opts.before.push(this); });
        $.each(opts.original.after,  function() { opts.after.push(this); });

        // re-init
        var init = $.fn.cycle.transitions[fx];
        if ($.isFunction(init))
            init(opts.$cont, $(opts.elements), opts);
    };

// this is the main engine fn, it handles the timeouts, callbacks and slide index mgmt
    function go(els, opts, manual, fwd) {
        var p = opts.$cont[0], curr = els[opts.currSlide], next = els[opts.nextSlide];

        // opts.busy is true if we're in the middle of an animation
        if (manual && opts.busy && opts.manualTrump) {
            // let manual transitions requests trump active ones
            debug('manualTrump in go(), stopping active transition');
            $(els).stop(true,true);
            opts.busy = 0;
            clearTimeout(p.cycleTimeout);
        }

        // don't begin another timeout-based transition if there is one active
        if (opts.busy) {
            debug('transition active, ignoring new tx request');
            return;
        }


        // stop cycling if we have an outstanding stop request
        if (p.cycleStop != opts.stopCount || p.cycleTimeout === 0 && !manual)
            return;

        // check to see if we should stop cycling based on autostop options
        if (!manual && !p.cyclePause && !opts.bounce &&
            ((opts.autostop && (--opts.countdown <= 0)) ||
                (opts.nowrap && !opts.random && opts.nextSlide < opts.currSlide))) {
            if (opts.end)
                opts.end(opts);
            return;
        }

        // if slideshow is paused, only transition on a manual trigger
        var changed = false;
        if ((manual || !p.cyclePause) && (opts.nextSlide != opts.currSlide)) {
            changed = true;
            var fx = opts.fx;
            // keep trying to get the slide size if we don't have it yet
            curr.cycleH = curr.cycleH || $(curr).height();
            curr.cycleW = curr.cycleW || $(curr).width();
            next.cycleH = next.cycleH || $(next).height();
            next.cycleW = next.cycleW || $(next).width();

            // support multiple transition types
            if (opts.multiFx) {
                if (fwd && (opts.lastFx === undefined || ++opts.lastFx >= opts.fxs.length))
                    opts.lastFx = 0;
                else if (!fwd && (opts.lastFx === undefined || --opts.lastFx < 0))
                    opts.lastFx = opts.fxs.length - 1;
                fx = opts.fxs[opts.lastFx];
            }

            // one-time fx overrides apply to:  $('div').cycle(3,'zoom');
            if (opts.oneTimeFx) {
                fx = opts.oneTimeFx;
                opts.oneTimeFx = null;
            }

            $.fn.cycle.resetState(opts, fx);

            // run the before callbacks
            if (opts.before.length)
                $.each(opts.before, function(i,o) {
                    if (p.cycleStop != opts.stopCount) return;
                    o.apply(next, [curr, next, opts, fwd]);
                });

            // stage the after callacks
            var after = function() {
                opts.busy = 0;
                $.each(opts.after, function(i,o) {
                    if (p.cycleStop != opts.stopCount) return;
                    o.apply(next, [curr, next, opts, fwd]);
                });
                if (!p.cycleStop) {
                    // queue next transition
                    queueNext();
                }
            };

            debug('tx firing('+fx+'); currSlide: ' + opts.currSlide + '; nextSlide: ' + opts.nextSlide);

            // get ready to perform the transition
            opts.busy = 1;
            if (opts.fxFn) // fx function provided?
                opts.fxFn(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
            else if ($.isFunction($.fn.cycle[opts.fx])) // fx plugin ?
                $.fn.cycle[opts.fx](curr, next, opts, after, fwd, manual && opts.fastOnEvent);
            else
                $.fn.cycle.custom(curr, next, opts, after, fwd, manual && opts.fastOnEvent);
        }
        else {
            queueNext();
        }

        if (changed || opts.nextSlide == opts.currSlide) {
            // calculate the next slide
            var roll;
            opts.lastSlide = opts.currSlide;
            if (opts.random) {
                opts.currSlide = opts.nextSlide;
                if (++opts.randomIndex == els.length) {
                    opts.randomIndex = 0;
                    opts.randomMap.sort(function(a,b) {return Math.random() - 0.5;});
                }
                opts.nextSlide = opts.randomMap[opts.randomIndex];
                if (opts.nextSlide == opts.currSlide)
                    opts.nextSlide = (opts.currSlide == opts.slideCount - 1) ? 0 : opts.currSlide + 1;
            }
            else if (opts.backwards) {
                roll = (opts.nextSlide - 1) < 0;
                if (roll && opts.bounce) {
                    opts.backwards = !opts.backwards;
                    opts.nextSlide = 1;
                    opts.currSlide = 0;
                }
                else {
                    opts.nextSlide = roll ? (els.length-1) : opts.nextSlide-1;
                    opts.currSlide = roll ? 0 : opts.nextSlide+1;
                }
            }
            else { // sequence
                roll = (opts.nextSlide + 1) == els.length;
                if (roll && opts.bounce) {
                    opts.backwards = !opts.backwards;
                    opts.nextSlide = els.length-2;
                    opts.currSlide = els.length-1;
                }
                else {
                    opts.nextSlide = roll ? 0 : opts.nextSlide+1;
                    opts.currSlide = roll ? els.length-1 : opts.nextSlide-1;
                }
            }
        }
        if (changed && opts.pager)
            opts.updateActivePagerLink(opts.pager, opts.currSlide, opts.activePagerClass);

        function queueNext() {
            // stage the next transition
            var ms = 0, timeout = opts.timeout;
            if (opts.timeout && !opts.continuous) {
                ms = getTimeout(els[opts.currSlide], els[opts.nextSlide], opts, fwd);
                if (opts.fx == 'shuffle')
                    ms -= opts.speedOut;
            }
            else if (opts.continuous && p.cyclePause) // continuous shows work off an after callback, not this timer logic
                ms = 10;
            if (ms > 0)
                p.cycleTimeout = setTimeout(function(){ go(els, opts, 0, !opts.backwards); }, ms);
        }
    }

// invoked after transition
    $.fn.cycle.updateActivePagerLink = function(pager, currSlide, clsName) {
        $(pager).each(function() {
            $(this).children().removeClass(clsName).eq(currSlide).addClass(clsName);
        });
    };

// calculate timeout value for current transition
    function getTimeout(curr, next, opts, fwd) {
        if (opts.timeoutFn) {
            // call user provided calc fn
            var t = opts.timeoutFn.call(curr,curr,next,opts,fwd);
            while (opts.fx != 'none' && (t - opts.speed) < 250) // sanitize timeout
                t += opts.speed;
            debug('calculated timeout: ' + t + '; speed: ' + opts.speed);
            if (t !== false)
                return t;
        }
        return opts.timeout;
    }

// expose next/prev function, caller must pass in state
    $.fn.cycle.next = function(opts) { advance(opts,1); };
    $.fn.cycle.prev = function(opts) { advance(opts,0);};

// advance slide forward or back
    function advance(opts, moveForward) {
        var val = moveForward ? 1 : -1;
        var els = opts.elements;
        var p = opts.$cont[0], timeout = p.cycleTimeout;
        if (timeout) {
            clearTimeout(timeout);
            p.cycleTimeout = 0;
        }
        if (opts.random && val < 0) {
            // move back to the previously display slide
            opts.randomIndex--;
            if (--opts.randomIndex == -2)
                opts.randomIndex = els.length-2;
            else if (opts.randomIndex == -1)
                opts.randomIndex = els.length-1;
            opts.nextSlide = opts.randomMap[opts.randomIndex];
        }
        else if (opts.random) {
            opts.nextSlide = opts.randomMap[opts.randomIndex];
        }
        else {
            opts.nextSlide = opts.currSlide + val;
            if (opts.nextSlide < 0) {
                if (opts.nowrap) return false;
                opts.nextSlide = els.length - 1;
            }
            else if (opts.nextSlide >= els.length) {
                if (opts.nowrap) return false;
                opts.nextSlide = 0;
            }
        }

        var cb = opts.onPrevNextEvent || opts.prevNextClick; // prevNextClick is deprecated
        if ($.isFunction(cb))
            cb(val > 0, opts.nextSlide, els[opts.nextSlide]);
        go(els, opts, 1, moveForward);
        return false;
    }

    function buildPager(els, opts) {
        var $p = $(opts.pager);
        $.each(els, function(i,o) {
            $.fn.cycle.createPagerAnchor(i,o,$p,els,opts);
        });
        opts.updateActivePagerLink(opts.pager, opts.startingSlide, opts.activePagerClass);
    }

    $.fn.cycle.createPagerAnchor = function(i, el, $p, els, opts) {
        var a;
        if ($.isFunction(opts.pagerAnchorBuilder)) {
            a = opts.pagerAnchorBuilder(i,el);
            debug('pagerAnchorBuilder('+i+', el) returned: ' + a);
        }
        else
            a = '<a href="#">'+(i+1)+'</a>';

        if (!a)
            return;
        var $a = $(a);
        // don't reparent if anchor is in the dom
        if ($a.parents('body').length === 0) {
            var arr = [];
            if ($p.length > 1) {
                $p.each(function() {
                    var $clone = $a.clone(true);
                    $(this).append($clone);
                    arr.push($clone[0]);
                });
                $a = $(arr);
            }
            else {
                $a.appendTo($p);
            }
        }

        opts.pagerAnchors =  opts.pagerAnchors || [];
        opts.pagerAnchors.push($a);

        var pagerFn = function(e) {
            e.preventDefault();
            opts.nextSlide = i;
            var p = opts.$cont[0], timeout = p.cycleTimeout;
            if (timeout) {
                clearTimeout(timeout);
                p.cycleTimeout = 0;
            }
            var cb = opts.onPagerEvent || opts.pagerClick; // pagerClick is deprecated
            if ($.isFunction(cb))
                cb(opts.nextSlide, els[opts.nextSlide]);
            go(els,opts,1,opts.currSlide < i); // trigger the trans
//		return false; // <== allow bubble
        };

        if ( /mouseenter|mouseover/i.test(opts.pagerEvent) ) {
            $a.hover(pagerFn, function(){/* no-op */} );
        }
        else {
            $a.bind(opts.pagerEvent, pagerFn);
        }

        if ( ! /^click/.test(opts.pagerEvent) && !opts.allowPagerClickBubble)
            $a.bind('click.cycle', function(){return false;}); // suppress click

        var cont = opts.$cont[0];
        var pauseFlag = false; // https://github.com/malsup/cycle/issues/44
        if (opts.pauseOnPagerHover) {
            $a.hover(
                function() {
                    pauseFlag = true;
                    cont.cyclePause++;
                    triggerPause(cont,true,true);
                }, function() {
                    if (pauseFlag)
                        cont.cyclePause--;
                    triggerPause(cont,true,true);
                }
            );
        }
    };

// helper fn to calculate the number of slides between the current and the next
    $.fn.cycle.hopsFromLast = function(opts, fwd) {
        var hops, l = opts.lastSlide, c = opts.currSlide;
        if (fwd)
            hops = c > l ? c - l : opts.slideCount - l;
        else
            hops = c < l ? l - c : l + opts.slideCount - c;
        return hops;
    };

// fix clearType problems in ie6 by setting an explicit bg color
// (otherwise text slides look horrible during a fade transition)
    function clearTypeFix($slides) {
        debug('applying clearType background-color hack');
        function hex(s) {
            s = parseInt(s,10).toString(16);
            return s.length < 2 ? '0'+s : s;
        }
        function getBg(e) {
            for ( ; e && e.nodeName.toLowerCase() != 'html'; e = e.parentNode) {
                var v = $.css(e,'background-color');
                if (v && v.indexOf('rgb') >= 0 ) {
                    var rgb = v.match(/\d+/g);
                    return '#'+ hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
                }
                if (v && v != 'transparent')
                    return v;
            }
            return '#ffffff';
        }
        $slides.each(function() { $(this).css('background-color', getBg(this)); });
    }

// reset common props before the next transition
    $.fn.cycle.commonReset = function(curr,next,opts,w,h,rev) {
        $(opts.elements).not(curr).hide();
        if (typeof opts.cssBefore.opacity == 'undefined')
            opts.cssBefore.opacity = 1;
        opts.cssBefore.display = 'block';
        if (opts.slideResize && w !== false && next.cycleW > 0)
            opts.cssBefore.width = next.cycleW;
        if (opts.slideResize && h !== false && next.cycleH > 0)
            opts.cssBefore.height = next.cycleH;
        opts.cssAfter = opts.cssAfter || {};
        opts.cssAfter.display = 'none';
        $(curr).css('zIndex',opts.slideCount + (rev === true ? 1 : 0));
        $(next).css('zIndex',opts.slideCount + (rev === true ? 0 : 1));
    };

// the actual fn for effecting a transition
    $.fn.cycle.custom = function(curr, next, opts, cb, fwd, speedOverride) {
        var $l = $(curr), $n = $(next);
        var speedIn = opts.speedIn, speedOut = opts.speedOut, easeIn = opts.easeIn, easeOut = opts.easeOut, animInDelay = opts.animInDelay, animOutDelay = opts.animOutDelay;
        $n.css(opts.cssBefore);
        if (speedOverride) {
            if (typeof speedOverride == 'number')
                speedIn = speedOut = speedOverride;
            else
                speedIn = speedOut = 1;
            easeIn = easeOut = null;
        }
        var fn = function() {
            $n.delay(animInDelay).animate(opts.animIn, speedIn, easeIn, function() {
                cb();
            });
        };
        $l.delay(animOutDelay).animate(opts.animOut, speedOut, easeOut, function() {
            $l.css(opts.cssAfter);
            if (!opts.sync)
                fn();
        });
        if (opts.sync) fn();
    };

// transition definitions - only fade is defined here, transition pack defines the rest
    $.fn.cycle.transitions = {
        fade: function($cont, $slides, opts) {
            $slides.not(':eq('+opts.currSlide+')').css('opacity',0);
            opts.before.push(function(curr,next,opts) {
                $.fn.cycle.commonReset(curr,next,opts);
                opts.cssBefore.opacity = 0;
            });
            opts.animIn	   = { opacity: 1 };
            opts.animOut   = { opacity: 0 };
            opts.cssBefore = { top: 0, left: 0 };
        }
    };

    $.fn.cycle.ver = function() { return ver; };

// override these globally if you like (they are all optional)
    $.fn.cycle.defaults = {
        activePagerClass: 'activeSlide', // class name used for the active pager link
        after:            null,     // transition callback (scope set to element that was shown):  function(currSlideElement, nextSlideElement, options, forwardFlag)
        allowPagerClickBubble: false, // allows or prevents click event on pager anchors from bubbling
        animIn:           null,     // properties that define how the slide animates in
        animInDelay:      0,        // allows delay before next slide transitions in
        animOut:          null,     // properties that define how the slide animates out
        animOutDelay:     0,        // allows delay before current slide transitions out
        aspect:           false,    // preserve aspect ratio during fit resizing, cropping if necessary (must be used with fit option)
        autostop:         0,        // true to end slideshow after X transitions (where X == slide count)
        autostopCount:    0,        // number of transitions (optionally used with autostop to define X)
        backwards:        false,    // true to start slideshow at last slide and move backwards through the stack
        before:           null,     // transition callback (scope set to element to be shown):     function(currSlideElement, nextSlideElement, options, forwardFlag)
        center:           null,     // set to true to have cycle add top/left margin to each slide (use with width and height options)
        cleartype:        !$.support.opacity,  // true if clearType corrections should be applied (for IE)
        cleartypeNoBg:    false,    // set to true to disable extra cleartype fixing (leave false to force background color setting on slides)
        containerResize:  1,        // resize container to fit largest slide
        containerResizeHeight:  0,  // resize containers height to fit the largest slide but leave the width dynamic
        continuous:       0,        // true to start next transition immediately after current one completes
        cssAfter:         null,     // properties that defined the state of the slide after transitioning out
        cssBefore:        null,     // properties that define the initial state of the slide before transitioning in
        delay:            0,        // additional delay (in ms) for first transition (hint: can be negative)
        easeIn:           null,     // easing for "in" transition
        easeOut:          null,     // easing for "out" transition
        easing:           null,     // easing method for both in and out transitions
        end:              null,     // callback invoked when the slideshow terminates (use with autostop or nowrap options): function(options)
        fastOnEvent:      0,        // force fast transitions when triggered manually (via pager or prev/next); value == time in ms
        fit:              0,        // force slides to fit container
        fx:               'fade',   // name of transition effect (or comma separated names, ex: 'fade,scrollUp,shuffle')
        fxFn:             null,     // function used to control the transition: function(currSlideElement, nextSlideElement, options, afterCalback, forwardFlag)
        height:           'auto',   // container height (if the 'fit' option is true, the slides will be set to this height as well)
        manualTrump:      true,     // causes manual transition to stop an active transition instead of being ignored
        metaAttr:         'cycle',  // data- attribute that holds the option data for the slideshow
        next:             null,     // element, jQuery object, or jQuery selector string for the element to use as event trigger for next slide
        nowrap:           0,        // true to prevent slideshow from wrapping
        onPagerEvent:     null,     // callback fn for pager events: function(zeroBasedSlideIndex, slideElement)
        onPrevNextEvent:  null,     // callback fn for prev/next events: function(isNext, zeroBasedSlideIndex, slideElement)
        pager:            null,     // element, jQuery object, or jQuery selector string for the element to use as pager container
        pagerAnchorBuilder: null,   // callback fn for building anchor links:  function(index, DOMelement)
        pagerEvent:       'click.cycle', // name of event which drives the pager navigation
        pause:            0,        // true to enable "pause on hover"
        pauseOnPagerHover: 0,       // true to pause when hovering over pager link
        prev:             null,     // element, jQuery object, or jQuery selector string for the element to use as event trigger for previous slide
        prevNextEvent:    'click.cycle',// event which drives the manual transition to the previous or next slide
        random:           0,        // true for random, false for sequence (not applicable to shuffle fx)
        randomizeEffects: 1,        // valid when multiple effects are used; true to make the effect sequence random
        requeueOnImageNotLoaded: true, // requeue the slideshow if any image slides are not yet loaded
        requeueTimeout:   250,      // ms delay for requeue
        rev:              0,        // causes animations to transition in reverse (for effects that support it such as scrollHorz/scrollVert/shuffle)
        shuffle:          null,     // coords for shuffle animation, ex: { top:15, left: 200 }
        skipInitializationCallbacks: false, // set to true to disable the first before/after callback that occurs prior to any transition
        slideExpr:        null,     // expression for selecting slides (if something other than all children is required)
        slideResize:      1,        // force slide width/height to fixed size before every transition
        speed:            1000,     // speed of the transition (any valid fx speed value)
        speedIn:          null,     // speed of the 'in' transition
        speedOut:         null,     // speed of the 'out' transition
        startingSlide:    undefined,// zero-based index of the first slide to be displayed
        sync:             1,        // true if in/out transitions should occur simultaneously
        timeout:          4000,     // milliseconds between slide transitions (0 to disable auto advance)
        timeoutFn:        null,     // callback for determining per-slide timeout value:  function(currSlideElement, nextSlideElement, options, forwardFlag)
        updateActivePagerLink: null,// callback fn invoked to update the active pager link (adds/removes activePagerClass style)
        width:            null      // container width (if the 'fit' option is true, the slides will be set to this width as well)
    };

})(jQuery);


/*!
 * jQuery Cycle Plugin Transition Definitions
 * This script is a plugin for the jQuery Cycle Plugin
 * Examples and documentation at: http://malsup.com/jquery/cycle/
 * Copyright (c) 2007-2010 M. Alsup
 * Version:	 2.73
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 */
(function($) {
    "use strict";

//
// These functions define slide initialization and properties for the named
// transitions. To save file size feel free to remove any of these that you
// don't need.
//
    $.fn.cycle.transitions.none = function($cont, $slides, opts) {
        opts.fxFn = function(curr,next,opts,after){
            $(next).show();
            $(curr).hide();
            after();
        };
    };

// not a cross-fade, fadeout only fades out the top slide
    $.fn.cycle.transitions.fadeout = function($cont, $slides, opts) {
        $slides.not(':eq('+opts.currSlide+')').css({ display: 'block', 'opacity': 1 });
        opts.before.push(function(curr,next,opts,w,h,rev) {
            $(curr).css('zIndex',opts.slideCount + (rev !== true ? 1 : 0));
            $(next).css('zIndex',opts.slideCount + (rev !== true ? 0 : 1));
        });
        opts.animIn.opacity = 1;
        opts.animOut.opacity = 0;
        opts.cssBefore.opacity = 1;
        opts.cssBefore.display = 'block';
        opts.cssAfter.zIndex = 0;
    };

// scrollUp/Down/Left/Right
    $.fn.cycle.transitions.scrollUp = function($cont, $slides, opts) {
        $cont.css('overflow','hidden');
        opts.before.push($.fn.cycle.commonReset);
        var h = $cont.height();
        opts.cssBefore.top = h;
        opts.cssBefore.left = 0;
        opts.cssFirst.top = 0;
        opts.animIn.top = 0;
        opts.animOut.top = -h;
    };
    $.fn.cycle.transitions.scrollDown = function($cont, $slides, opts) {
        $cont.css('overflow','hidden');
        opts.before.push($.fn.cycle.commonReset);
        var h = $cont.height();
        opts.cssFirst.top = 0;
        opts.cssBefore.top = -h;
        opts.cssBefore.left = 0;
        opts.animIn.top = 0;
        opts.animOut.top = h;
    };
    $.fn.cycle.transitions.scrollLeft = function($cont, $slides, opts) {
        $cont.css('overflow','hidden');
        opts.before.push($.fn.cycle.commonReset);
        var w = $cont.width();
        opts.cssFirst.left = 0;
        opts.cssBefore.left = w;
        opts.cssBefore.top = 0;
        opts.animIn.left = 0;
        opts.animOut.left = 0-w;
    };
    $.fn.cycle.transitions.scrollRight = function($cont, $slides, opts) {
        $cont.css('overflow','hidden');
        opts.before.push($.fn.cycle.commonReset);
        var w = $cont.width();
        opts.cssFirst.left = 0;
        opts.cssBefore.left = -w;
        opts.cssBefore.top = 0;
        opts.animIn.left = 0;
        opts.animOut.left = w;
    };
    $.fn.cycle.transitions.scrollHorz = function($cont, $slides, opts) {
        $cont.css('overflow','hidden').width();
        opts.before.push(function(curr, next, opts, fwd) {
            if (opts.rev)
                fwd = !fwd;
            $.fn.cycle.commonReset(curr,next,opts);
            opts.cssBefore.left = fwd ? (next.cycleW-1) : (1-next.cycleW);
            opts.animOut.left = fwd ? -curr.cycleW : curr.cycleW;
        });
        opts.cssFirst.left = 0;
        opts.cssBefore.top = 0;
        opts.animIn.left = 0;
        opts.animOut.top = 0;
    };
    $.fn.cycle.transitions.scrollVert = function($cont, $slides, opts) {
        $cont.css('overflow','hidden');
        opts.before.push(function(curr, next, opts, fwd) {
            if (opts.rev)
                fwd = !fwd;
            $.fn.cycle.commonReset(curr,next,opts);
            opts.cssBefore.top = fwd ? (1-next.cycleH) : (next.cycleH-1);
            opts.animOut.top = fwd ? curr.cycleH : -curr.cycleH;
        });
        opts.cssFirst.top = 0;
        opts.cssBefore.left = 0;
        opts.animIn.top = 0;
        opts.animOut.left = 0;
    };

// slideX/slideY
    $.fn.cycle.transitions.slideX = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $(opts.elements).not(curr).hide();
            $.fn.cycle.commonReset(curr,next,opts,false,true);
            opts.animIn.width = next.cycleW;
        });
        opts.cssBefore.left = 0;
        opts.cssBefore.top = 0;
        opts.cssBefore.width = 0;
        opts.animIn.width = 'show';
        opts.animOut.width = 0;
    };
    $.fn.cycle.transitions.slideY = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $(opts.elements).not(curr).hide();
            $.fn.cycle.commonReset(curr,next,opts,true,false);
            opts.animIn.height = next.cycleH;
        });
        opts.cssBefore.left = 0;
        opts.cssBefore.top = 0;
        opts.cssBefore.height = 0;
        opts.animIn.height = 'show';
        opts.animOut.height = 0;
    };

// shuffle
    $.fn.cycle.transitions.shuffle = function($cont, $slides, opts) {
        var i, w = $cont.css('overflow', 'visible').width();
        $slides.css({left: 0, top: 0});
        opts.before.push(function(curr,next,opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,true,true);
        });
        // only adjust speed once!
        if (!opts.speedAdjusted) {
            opts.speed = opts.speed / 2; // shuffle has 2 transitions
            opts.speedAdjusted = true;
        }
        opts.random = 0;
        opts.shuffle = opts.shuffle || {left:-w, top:15};
        opts.els = [];
        for (i=0; i < $slides.length; i++)
            opts.els.push($slides[i]);

        for (i=0; i < opts.currSlide; i++)
            opts.els.push(opts.els.shift());

        // custom transition fn (hat tip to Benjamin Sterling for this bit of sweetness!)
        opts.fxFn = function(curr, next, opts, cb, fwd) {
            if (opts.rev)
                fwd = !fwd;
            var $el = fwd ? $(curr) : $(next);
            $(next).css(opts.cssBefore);
            var count = opts.slideCount;
            $el.animate(opts.shuffle, opts.speedIn, opts.easeIn, function() {
                var hops = $.fn.cycle.hopsFromLast(opts, fwd);
                for (var k=0; k < hops; k++) {
                    if (fwd)
                        opts.els.push(opts.els.shift());
                    else
                        opts.els.unshift(opts.els.pop());
                }
                if (fwd) {
                    for (var i=0, len=opts.els.length; i < len; i++)
                        $(opts.els[i]).css('z-index', len-i+count);
                }
                else {
                    var z = $(curr).css('z-index');
                    $el.css('z-index', parseInt(z,10)+1+count);
                }
                $el.animate({left:0, top:0}, opts.speedOut, opts.easeOut, function() {
                    $(fwd ? this : curr).hide();
                    if (cb) cb();
                });
            });
        };
        $.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
    };

// turnUp/Down/Left/Right
    $.fn.cycle.transitions.turnUp = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,false);
            opts.cssBefore.top = next.cycleH;
            opts.animIn.height = next.cycleH;
            opts.animOut.width = next.cycleW;
        });
        opts.cssFirst.top = 0;
        opts.cssBefore.left = 0;
        opts.cssBefore.height = 0;
        opts.animIn.top = 0;
        opts.animOut.height = 0;
    };
    $.fn.cycle.transitions.turnDown = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,false);
            opts.animIn.height = next.cycleH;
            opts.animOut.top   = curr.cycleH;
        });
        opts.cssFirst.top = 0;
        opts.cssBefore.left = 0;
        opts.cssBefore.top = 0;
        opts.cssBefore.height = 0;
        opts.animOut.height = 0;
    };
    $.fn.cycle.transitions.turnLeft = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,true);
            opts.cssBefore.left = next.cycleW;
            opts.animIn.width = next.cycleW;
        });
        opts.cssBefore.top = 0;
        opts.cssBefore.width = 0;
        opts.animIn.left = 0;
        opts.animOut.width = 0;
    };
    $.fn.cycle.transitions.turnRight = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,true);
            opts.animIn.width = next.cycleW;
            opts.animOut.left = curr.cycleW;
        });
        $.extend(opts.cssBefore, { top: 0, left: 0, width: 0 });
        opts.animIn.left = 0;
        opts.animOut.width = 0;
    };

// zoom
    $.fn.cycle.transitions.zoom = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,false,true);
            opts.cssBefore.top = next.cycleH/2;
            opts.cssBefore.left = next.cycleW/2;
            $.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
            $.extend(opts.animOut, { width: 0, height: 0, top: curr.cycleH/2, left: curr.cycleW/2 });
        });
        opts.cssFirst.top = 0;
        opts.cssFirst.left = 0;
        opts.cssBefore.width = 0;
        opts.cssBefore.height = 0;
    };

// fadeZoom
    $.fn.cycle.transitions.fadeZoom = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,false);
            opts.cssBefore.left = next.cycleW/2;
            opts.cssBefore.top = next.cycleH/2;
            $.extend(opts.animIn, { top: 0, left: 0, width: next.cycleW, height: next.cycleH });
        });
        opts.cssBefore.width = 0;
        opts.cssBefore.height = 0;
        opts.animOut.opacity = 0;
    };

// blindX
    $.fn.cycle.transitions.blindX = function($cont, $slides, opts) {
        var w = $cont.css('overflow','hidden').width();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts);
            opts.animIn.width = next.cycleW;
            opts.animOut.left   = curr.cycleW;
        });
        opts.cssBefore.left = w;
        opts.cssBefore.top = 0;
        opts.animIn.left = 0;
        opts.animOut.left = w;
    };
// blindY
    $.fn.cycle.transitions.blindY = function($cont, $slides, opts) {
        var h = $cont.css('overflow','hidden').height();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts);
            opts.animIn.height = next.cycleH;
            opts.animOut.top   = curr.cycleH;
        });
        opts.cssBefore.top = h;
        opts.cssBefore.left = 0;
        opts.animIn.top = 0;
        opts.animOut.top = h;
    };
// blindZ
    $.fn.cycle.transitions.blindZ = function($cont, $slides, opts) {
        var h = $cont.css('overflow','hidden').height();
        var w = $cont.width();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts);
            opts.animIn.height = next.cycleH;
            opts.animOut.top   = curr.cycleH;
        });
        opts.cssBefore.top = h;
        opts.cssBefore.left = w;
        opts.animIn.top = 0;
        opts.animIn.left = 0;
        opts.animOut.top = h;
        opts.animOut.left = w;
    };

// growX - grow horizontally from centered 0 width
    $.fn.cycle.transitions.growX = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,true);
            opts.cssBefore.left = this.cycleW/2;
            opts.animIn.left = 0;
            opts.animIn.width = this.cycleW;
            opts.animOut.left = 0;
        });
        opts.cssBefore.top = 0;
        opts.cssBefore.width = 0;
    };
// growY - grow vertically from centered 0 height
    $.fn.cycle.transitions.growY = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,false);
            opts.cssBefore.top = this.cycleH/2;
            opts.animIn.top = 0;
            opts.animIn.height = this.cycleH;
            opts.animOut.top = 0;
        });
        opts.cssBefore.height = 0;
        opts.cssBefore.left = 0;
    };

// curtainX - squeeze in both edges horizontally
    $.fn.cycle.transitions.curtainX = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,false,true,true);
            opts.cssBefore.left = next.cycleW/2;
            opts.animIn.left = 0;
            opts.animIn.width = this.cycleW;
            opts.animOut.left = curr.cycleW/2;
            opts.animOut.width = 0;
        });
        opts.cssBefore.top = 0;
        opts.cssBefore.width = 0;
    };
// curtainY - squeeze in both edges vertically
    $.fn.cycle.transitions.curtainY = function($cont, $slides, opts) {
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,false,true);
            opts.cssBefore.top = next.cycleH/2;
            opts.animIn.top = 0;
            opts.animIn.height = next.cycleH;
            opts.animOut.top = curr.cycleH/2;
            opts.animOut.height = 0;
        });
        opts.cssBefore.height = 0;
        opts.cssBefore.left = 0;
    };

// cover - curr slide covered by next slide
    $.fn.cycle.transitions.cover = function($cont, $slides, opts) {
        var d = opts.direction || 'left';
        var w = $cont.css('overflow','hidden').width();
        var h = $cont.height();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts);
            opts.cssAfter.display = '';
            if (d == 'right')
                opts.cssBefore.left = -w;
            else if (d == 'up')
                opts.cssBefore.top = h;
            else if (d == 'down')
                opts.cssBefore.top = -h;
            else
                opts.cssBefore.left = w;
        });
        opts.animIn.left = 0;
        opts.animIn.top = 0;
        opts.cssBefore.top = 0;
        opts.cssBefore.left = 0;
    };

// uncover - curr slide moves off next slide
    $.fn.cycle.transitions.uncover = function($cont, $slides, opts) {
        var d = opts.direction || 'left';
        var w = $cont.css('overflow','hidden').width();
        var h = $cont.height();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,true,true);
            if (d == 'right')
                opts.animOut.left = w;
            else if (d == 'up')
                opts.animOut.top = -h;
            else if (d == 'down')
                opts.animOut.top = h;
            else
                opts.animOut.left = -w;
        });
        opts.animIn.left = 0;
        opts.animIn.top = 0;
        opts.cssBefore.top = 0;
        opts.cssBefore.left = 0;
    };

// toss - move top slide and fade away
    $.fn.cycle.transitions.toss = function($cont, $slides, opts) {
        var w = $cont.css('overflow','visible').width();
        var h = $cont.height();
        opts.before.push(function(curr, next, opts) {
            $.fn.cycle.commonReset(curr,next,opts,true,true,true);
            // provide default toss settings if animOut not provided
            if (!opts.animOut.left && !opts.animOut.top)
                $.extend(opts.animOut, { left: w*2, top: -h/2, opacity: 0 });
            else
                opts.animOut.opacity = 0;
        });
        opts.cssBefore.left = 0;
        opts.cssBefore.top = 0;
        opts.animIn.left = 0;
    };

// wipe - clip animation
    $.fn.cycle.transitions.wipe = function($cont, $slides, opts) {
        var w = $cont.css('overflow','hidden').width();
        var h = $cont.height();
        opts.cssBefore = opts.cssBefore || {};
        var clip;
        if (opts.clip) {
            if (/l2r/.test(opts.clip))
                clip = 'rect(0px 0px '+h+'px 0px)';
            else if (/r2l/.test(opts.clip))
                clip = 'rect(0px '+w+'px '+h+'px '+w+'px)';
            else if (/t2b/.test(opts.clip))
                clip = 'rect(0px '+w+'px 0px 0px)';
            else if (/b2t/.test(opts.clip))
                clip = 'rect('+h+'px '+w+'px '+h+'px 0px)';
            else if (/zoom/.test(opts.clip)) {
                var top = parseInt(h/2,10);
                var left = parseInt(w/2,10);
                clip = 'rect('+top+'px '+left+'px '+top+'px '+left+'px)';
            }
        }

        opts.cssBefore.clip = opts.cssBefore.clip || clip || 'rect(0px 0px 0px 0px)';

        var d = opts.cssBefore.clip.match(/(\d+)/g);
        var t = parseInt(d[0],10), r = parseInt(d[1],10), b = parseInt(d[2],10), l = parseInt(d[3],10);

        opts.before.push(function(curr, next, opts) {
            if (curr == next) return;
            var $curr = $(curr), $next = $(next);
            $.fn.cycle.commonReset(curr,next,opts,true,true,false);
            opts.cssAfter.display = 'block';

            var step = 1, count = parseInt((opts.speedIn / 13),10) - 1;
            (function f() {
                var tt = t ? t - parseInt(step * (t/count),10) : 0;
                var ll = l ? l - parseInt(step * (l/count),10) : 0;
                var bb = b < h ? b + parseInt(step * ((h-b)/count || 1),10) : h;
                var rr = r < w ? r + parseInt(step * ((w-r)/count || 1),10) : w;
                $next.css({ clip: 'rect('+tt+'px '+rr+'px '+bb+'px '+ll+'px)' });
                (step++ <= count) ? setTimeout(f, 13) : $curr.css('display', 'none');
            })();
        });
        $.extend(opts.cssBefore, { display: 'block', opacity: 1, top: 0, left: 0 });
        opts.animIn	   = { left: 0 };
        opts.animOut   = { left: 0 };
    };

})(jQuery);

/*
 * FancyBox - jQuery Plugin
 * Simple and fancy lightbox alternative
 *
 * Examples and documentation at: http://fancybox.net
 *
 * Copyright (c) 2008 - 2010 Janis Skarnelis
 * That said, it is hardly a one-person project. Many people have submitted bugs, code, and offered their advice freely. Their support is greatly appreciated.
 *
 * Version: 1.3.4 (11/11/2010)
 * Requires: jQuery v1.3+
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */
;(function(B){var L,T,Q,M,d,m,J,A,O,z,C=0,H={},j=[],e=0,G={},y=[],f=null,o=new Image(),i=/\.(jpg|gif|png|bmp|jpeg)(.*)?$/i,k=/[^\.]\.(swf)\s*$/i,p,N=1,h=0,t="",b,c,P=false,s=B.extend(B("<div/>")[0],{prop:0}),S=/MSIE 6/.test(navigator.userAgent)&&B.browser.version<7&&!window.XMLHttpRequest,r=function(){T.hide();o.onerror=o.onload=null;if(f){f.abort()}L.empty()},x=function(){if(false===H.onError(j,C,H)){T.hide();P=false;return}H.titleShow=false;H.width="auto";H.height="auto";L.html('<p id="fancybox-error">The requested content cannot be loaded.<br />Please try again later.</p>');n()},w=function(){var Z=j[C],W,Y,ab,aa,V,X;r();H=B.extend({},B.fn.fancybox.defaults,(typeof B(Z).data("fancybox")=="undefined"?H:B(Z).data("fancybox")));X=H.onStart(j,C,H);if(X===false){P=false;return}else{if(typeof X=="object"){H=B.extend(H,X)}}ab=H.title||(Z.nodeName?B(Z).attr("title"):Z.title)||"";if(Z.nodeName&&!H.orig){H.orig=B(Z).children("img:first").length?B(Z).children("img:first"):B(Z)}if(ab===""&&H.orig&&H.titleFromAlt){ab=H.orig.attr("alt")}W=H.href||(Z.nodeName?B(Z).attr("href"):Z.href)||null;if((/^(?:javascript)/i).test(W)||W=="#"){W=null}if(H.type){Y=H.type;if(!W){W=H.content}}else{if(H.content){Y="html"}else{if(W){if(W.match(i)){Y="image"}else{if(W.match(k)){Y="swf"}else{if(B(Z).hasClass("iframe")){Y="iframe"}else{if(W.indexOf("#")===0){Y="inline"}else{Y="ajax"}}}}}}}if(!Y){x();return}if(Y=="inline"){Z=W.substr(W.indexOf("#"));Y=B(Z).length>0?"inline":"ajax"}H.type=Y;H.href=W;H.title=ab;if(H.autoDimensions){if(H.type=="html"||H.type=="inline"||H.type=="ajax"){H.width="auto";H.height="auto"}else{H.autoDimensions=false}}if(H.modal){H.overlayShow=true;H.hideOnOverlayClick=false;H.hideOnContentClick=false;H.enableEscapeButton=false;H.showCloseButton=false}H.padding=parseInt(H.padding,10);H.margin=parseInt(H.margin,10);L.css("padding",(H.padding+H.margin));B(".fancybox-inline-tmp").unbind("fancybox-cancel").bind("fancybox-change",function(){B(this).replaceWith(m.children())});switch(Y){case"html":L.html(H.content);n();break;case"inline":if(B(Z).parent().is("#fancybox-content")===true){P=false;return}B('<div class="fancybox-inline-tmp" />').hide().insertBefore(B(Z)).bind("fancybox-cleanup",function(){B(this).replaceWith(m.children())}).bind("fancybox-cancel",function(){B(this).replaceWith(L.children())});B(Z).appendTo(L);n();break;case"image":P=false;B.fancybox.showActivity();o=new Image();o.onerror=function(){x()};o.onload=function(){P=true;o.onerror=o.onload=null;F()};o.src=W;break;case"swf":H.scrolling="no";aa='<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" width="'+H.width+'" height="'+H.height+'"><param name="movie" value="'+W+'"></param>';V="";B.each(H.swf,function(ac,ad){aa+='<param name="'+ac+'" value="'+ad+'"></param>';V+=" "+ac+'="'+ad+'"'});aa+='<embed src="'+W+'" type="application/x-shockwave-flash" width="'+H.width+'" height="'+H.height+'"'+V+"></embed></object>";L.html(aa);n();break;case"ajax":P=false;B.fancybox.showActivity();H.ajax.win=H.ajax.success;f=B.ajax(B.extend({},H.ajax,{url:W,data:H.ajax.data||{},dataType:"text",error:function(ac,ae,ad){if(ac.status>0){x()}},success:function(ad,af,ac){var ae=typeof ac=="object"?ac:f;if(ae.status==200||ae.status===0){if(typeof H.ajax.win=="function"){X=H.ajax.win(W,ad,af,ac);if(X===false){T.hide();return}else{if(typeof X=="string"||typeof X=="object"){ad=X}}}L.html(ad);n()}}}));break;case"iframe":E();break}},n=function(){var V=H.width,W=H.height;if(V.toString().indexOf("%")>-1){V=parseInt((B(window).width()-(H.margin*2))*parseFloat(V)/100,10)+"px"}else{V=V=="auto"?"auto":V+"px"}if(W.toString().indexOf("%")>-1){W=parseInt((B(window).height()-(H.margin*2))*parseFloat(W)/100,10)+"px"}else{W=W=="auto"?"auto":W+"px"}L.wrapInner('<div style="width:'+V+";height:"+W+";overflow: "+(H.scrolling=="auto"?"auto":(H.scrolling=="yes"?"scroll":"hidden"))+';position:relative;"></div>');H.width=L.width();H.height=L.height();E()},F=function(){H.width=o.width;H.height=o.height;B("<img />").attr({id:"fancybox-img",src:o.src,alt:H.title}).appendTo(L);E()},E=function(){var W,V;T.hide();if(M.is(":visible")&&false===G.onCleanup(y,e,G)){B('.fancybox-inline-tmp').trigger('fancybox-cancel');P=false;return}P=true;B(m.add(Q)).unbind();B(window).unbind("resize.fb scroll.fb");B(document).unbind("keydown.fb");if(M.is(":visible")&&G.titlePosition!=="outside"){M.css("height",M.height())}y=j;e=C;G=H;if(G.overlayShow){Q.css({"background-color":G.overlayColor,opacity:G.overlayOpacity,cursor:G.hideOnOverlayClick?"pointer":"auto",height:B(document).height()});if(!Q.is(":visible")){if(S){B("select:not(#fancybox-tmp select)").filter(function(){return this.style.visibility!=="hidden"}).css({visibility:"hidden"}).one("fancybox-cleanup",function(){this.style.visibility="inherit"})}Q.show()}}else{Q.hide()}c=R();l();if(M.is(":visible")){B(J.add(O).add(z)).hide();W=M.position(),b={top:W.top,left:W.left,width:M.width(),height:M.height()};V=(b.width==c.width&&b.height==c.height);m.fadeTo(G.changeFade,0.3,function(){var X=function(){m.html(L.contents()).fadeTo(G.changeFade,1,v)};B('.fancybox-inline-tmp').trigger('fancybox-change');m.empty().removeAttr("filter").css({"border-width":G.padding,width:c.width-G.padding*2,height:H.autoDimensions?"auto":c.height-h-G.padding*2});if(V){X()}else{s.prop=0;B(s).animate({prop:1},{duration:G.changeSpeed,easing:G.easingChange,step:U,complete:X})}});return}M.removeAttr("style");m.css("border-width",G.padding);if(G.transitionIn=="elastic"){b=I();m.html(L.contents());M.show();if(G.opacity){c.opacity=0}s.prop=0;B(s).animate({prop:1},{duration:G.speedIn,easing:G.easingIn,step:U,complete:v});return}if(G.titlePosition=="inside"&&h>0){A.show()}m.css({width:c.width-G.padding*2,height:H.autoDimensions?"auto":c.height-h-G.padding*2}).html(L.contents());M.css(c).fadeIn(G.transitionIn=="none"?0:G.speedIn,v)},D=function(V){if(V&&V.length){if(G.titlePosition=="float"){return'<table id="fancybox-title-float-wrap" cellpadding="0" cellspacing="0"><tr><td id="fancybox-title-float-left"></td><td id="fancybox-title-float-main">'+V+'</td><td id="fancybox-title-float-right"></td></tr></table>'}return'<div id="fancybox-title-'+G.titlePosition+'">'+V+"</div>"}return false},l=function(){t=G.title||"";h=0;A.empty().removeAttr("style").removeClass();if(G.titleShow===false){A.hide();return}t=B.isFunction(G.titleFormat)?G.titleFormat(t,y,e,G):D(t);if(!t||t===""){A.hide();return}A.addClass("fancybox-title-"+G.titlePosition).html(t).appendTo("body").show();switch(G.titlePosition){case"inside":A.css({width:c.width-(G.padding*2),marginLeft:G.padding,marginRight:G.padding});h=A.outerHeight(true);A.appendTo(d);c.height+=h;break;case"over":A.css({marginLeft:G.padding,width:c.width-(G.padding*2),bottom:G.padding}).appendTo(d);break;case"float":A.css("left",parseInt((A.width()-c.width-40)/2,10)*-1).appendTo(M);break;default:A.css({width:c.width-(G.padding*2),paddingLeft:G.padding,paddingRight:G.padding}).appendTo(M);break}A.hide()},g=function(){if(G.enableEscapeButton||G.enableKeyboardNav){B(document).bind("keydown.fb",function(V){if(V.keyCode==27&&G.enableEscapeButton){V.preventDefault();B.fancybox.close()}else{if((V.keyCode==37||V.keyCode==39)&&G.enableKeyboardNav&&V.target.tagName!=="INPUT"&&V.target.tagName!=="TEXTAREA"&&V.target.tagName!=="SELECT"){V.preventDefault();B.fancybox[V.keyCode==37?"prev":"next"]()}}})}if(!G.showNavArrows){O.hide();z.hide();return}if((G.cyclic&&y.length>1)||e!==0){O.show()}if((G.cyclic&&y.length>1)||e!=(y.length-1)){z.show()}},v=function(){if(B.support.opacity===false){m.get(0).style.removeAttribute("filter");M.get(0).style.removeAttribute("filter")}if(H.autoDimensions){m.css("height","auto")}M.css("height","auto");if(t&&t.length){A.show()}if(G.showCloseButton){J.show()}g();if(G.hideOnContentClick){m.bind("click",B.fancybox.close)}if(G.hideOnOverlayClick){Q.bind("click",B.fancybox.close)}B(window).bind("resize.fb",B.fancybox.resize);if(G.centerOnScroll){B(window).bind("scroll.fb",B.fancybox.center)}if(G.type=="iframe"){B('<iframe id="fancybox-frame" name="fancybox-frame'+new Date().getTime()+'" frameborder="0" hspace="0" '+(window.attachEvent?'allowtransparency="true""':"")+' scrolling="'+H.scrolling+'" src="'+G.href+'"></iframe>').appendTo(m)}M.show();P=false;B.fancybox.center();G.onComplete(y,e,G);K()},K=function(){var V,W;if((y.length-1)>e){V=y[e+1].href;if(typeof V!=="undefined"&&V.match(i)){W=new Image();W.src=V}}if(e>0){V=y[e-1].href;if(typeof V!=="undefined"&&V.match(i)){W=new Image();W.src=V}}},U=function(W){var V={width:parseInt(b.width+(c.width-b.width)*W,10),height:parseInt(b.height+(c.height-b.height)*W,10),top:parseInt(b.top+(c.top-b.top)*W,10),left:parseInt(b.left+(c.left-b.left)*W,10)};if(typeof c.opacity!=="undefined"){V.opacity=W<0.5?0.5:W}M.css(V);m.css({width:V.width-G.padding*2,height:V.height-(h*W)-G.padding*2})},u=function(){return[B(window).width()-(G.margin*2),B(window).height()-(G.margin*2),B(document).scrollLeft()+G.margin,B(document).scrollTop()+G.margin]},R=function(){var V=u(),Z={},W=G.autoScale,X=G.padding*2,Y;if(G.width.toString().indexOf("%")>-1){Z.width=parseInt((V[0]*parseFloat(G.width))/100,10)}else{Z.width=G.width+X}if(G.height.toString().indexOf("%")>-1){Z.height=parseInt((V[1]*parseFloat(G.height))/100,10)}else{Z.height=G.height+X}if(W&&(Z.width>V[0]||Z.height>V[1])){if(H.type=="image"||H.type=="swf"){Y=(G.width)/(G.height);if((Z.width)>V[0]){Z.width=V[0];Z.height=parseInt(((Z.width-X)/Y)+X,10)}if((Z.height)>V[1]){Z.height=V[1];Z.width=parseInt(((Z.height-X)*Y)+X,10)}}else{Z.width=Math.min(Z.width,V[0]);Z.height=Math.min(Z.height,V[1])}}Z.top=parseInt(Math.max(V[3]-20,V[3]+((V[1]-Z.height-40)*0.5)),10);Z.left=parseInt(Math.max(V[2]-20,V[2]+((V[0]-Z.width-40)*0.5)),10);return Z},q=function(V){var W=V.offset();W.top+=parseInt(V.css("paddingTop"),10)||0;W.left+=parseInt(V.css("paddingLeft"),10)||0;W.top+=parseInt(V.css("border-top-width"),10)||0;W.left+=parseInt(V.css("border-left-width"),10)||0;W.width=V.width();W.height=V.height();return W},I=function(){var Y=H.orig?B(H.orig):false,X={},W,V;if(Y&&Y.length){W=q(Y);X={width:W.width+(G.padding*2),height:W.height+(G.padding*2),top:W.top-G.padding-20,left:W.left-G.padding-20}}else{V=u();X={width:G.padding*2,height:G.padding*2,top:parseInt(V[3]+V[1]*0.5,10),left:parseInt(V[2]+V[0]*0.5,10)}}return X},a=function(){if(!T.is(":visible")){clearInterval(p);return}B("div",T).css("top",(N*-40)+"px");N=(N+1)%12};B.fn.fancybox=function(V){if(!B(this).length){return this}B(this).data("fancybox",B.extend({},V,(B.metadata?B(this).metadata():{}))).unbind("click.fb").bind("click.fb",function(X){X.preventDefault();if(P){return}P=true;B(this).blur();j=[];C=0;var W=B(this).attr("rel")||"";if(!W||W==""||W==="nofollow"){j.push(this)}else{j=B('a[rel="'+W+'"], area[rel="'+W+'"]');C=j.index(this)}w();return});return this};B.fancybox=function(Y){var X;if(P){return}P=true;X=typeof arguments[1]!=="undefined"?arguments[1]:{};j=[];C=parseInt(X.index,10)||0;if(B.isArray(Y)){for(var W=0,V=Y.length;W<V;W++){if(typeof Y[W]=="object"){B(Y[W]).data("fancybox",B.extend({},X,Y[W]))}else{Y[W]=B({}).data("fancybox",B.extend({content:Y[W]},X))}}j=jQuery.merge(j,Y)}else{if(typeof Y=="object"){B(Y).data("fancybox",B.extend({},X,Y))}else{Y=B({}).data("fancybox",B.extend({content:Y},X))}j.push(Y)}if(C>j.length||C<0){C=0}w()};B.fancybox.showActivity=function(){clearInterval(p);T.show();p=setInterval(a,66)};B.fancybox.hideActivity=function(){T.hide()};B.fancybox.next=function(){return B.fancybox.pos(e+1)};B.fancybox.prev=function(){return B.fancybox.pos(e-1)};B.fancybox.pos=function(V){if(P){return}V=parseInt(V);j=y;if(V>-1&&V<y.length){C=V;w()}else{if(G.cyclic&&y.length>1){C=V>=y.length?0:y.length-1;w()}}return};B.fancybox.cancel=function(){if(P){return}P=true;B('.fancybox-inline-tmp').trigger('fancybox-cancel');r();H.onCancel(j,C,H);P=false};B.fancybox.close=function(){if(P||M.is(":hidden")){return}P=true;if(G&&false===G.onCleanup(y,e,G)){P=false;return}r();B(J.add(O).add(z)).hide();B(m.add(Q)).unbind();B(window).unbind("resize.fb scroll.fb");B(document).unbind("keydown.fb");if(G.type==="iframe"){m.find("iframe").attr("src",S&&/^https/i.test(window.location.href||"")?"javascript:void(false)":"about:blank")}if(G.titlePosition!=="inside"){A.empty()}M.stop();function V(){Q.fadeOut("fast");A.empty().hide();M.hide();B('.fancybox-inline-tmp').trigger('fancybox-cleanup');m.empty();G.onClosed(y,e,G);y=H=[];e=C=0;G=H={};P=false}if(G.transitionOut=="elastic"){b=I();var W=M.position();c={top:W.top,left:W.left,width:M.width(),height:M.height()};if(G.opacity){c.opacity=1}A.empty().hide();s.prop=1;B(s).animate({prop:0},{duration:G.speedOut,easing:G.easingOut,step:U,complete:V})}else{M.fadeOut(G.transitionOut=="none"?0:G.speedOut,V)}};B.fancybox.resize=function(){if(Q.is(":visible")){Q.css("height",B(document).height())}B.fancybox.center(true)};B.fancybox.center=function(){var V,W;if(P){return}W=arguments[0]===true?1:0;V=u();if(!W&&(M.width()>V[0]||M.height()>V[1])){return}M.stop().animate({top:parseInt(Math.max(V[3]-20,V[3]+((V[1]-m.height()-40)*0.5)-G.padding)),left:parseInt(Math.max(V[2]-20,V[2]+((V[0]-m.width()-40)*0.5)-G.padding))},typeof arguments[0]=="number"?arguments[0]:200)};B.fancybox.init=function(){if(B("#fancybox-wrap").length){return}B("body").append(L=B('<div id="fancybox-tmp"></div>'),T=B('<div id="fancybox-loading"><div></div></div>'),Q=B('<div id="fancybox-overlay"></div>'),M=B('<div id="fancybox-wrap"></div>'));d=B('<div id="fancybox-outer"></div>').append('<div class="fancybox-bg" id="fancybox-bg-n"></div><div class="fancybox-bg" id="fancybox-bg-ne"></div><div class="fancybox-bg" id="fancybox-bg-e"></div><div class="fancybox-bg" id="fancybox-bg-se"></div><div class="fancybox-bg" id="fancybox-bg-s"></div><div class="fancybox-bg" id="fancybox-bg-sw"></div><div class="fancybox-bg" id="fancybox-bg-w"></div><div class="fancybox-bg" id="fancybox-bg-nw"></div>').appendTo(M);d.append(m=B('<div id="fancybox-content"></div>'),J=B('<a id="fancybox-close"></a>'),A=B('<div id="fancybox-title"></div>'),O=B('<a href="javascript:;" id="fancybox-left"><span class="fancy-ico" id="fancybox-left-ico"></span></a>'),z=B('<a href="javascript:;" id="fancybox-right"><span class="fancy-ico" id="fancybox-right-ico"></span></a>'));J.click(B.fancybox.close);T.click(B.fancybox.cancel);O.click(function(V){V.preventDefault();B.fancybox.prev()});z.click(function(V){V.preventDefault();B.fancybox.next()});if(B.fn.mousewheel){M.bind("mousewheel.fb",function(V,W){if(P){V.preventDefault()}else{if(B(V.target).get(0).clientHeight==0||B(V.target).get(0).scrollHeight===B(V.target).get(0).clientHeight){V.preventDefault();B.fancybox[W>0?"prev":"next"]()}}})}if(B.support.opacity===false){M.addClass("fancybox-ie")}if(S){T.addClass("fancybox-ie6");M.addClass("fancybox-ie6");B('<iframe id="fancybox-hide-sel-frame" src="'+(/^https/i.test(window.location.href||"")?"javascript:void(false)":"about:blank")+'" scrolling="no" border="0" frameborder="0" tabindex="-1"></iframe>').prependTo(d)}};B.fn.fancybox.defaults={padding:10,margin:40,opacity:false,modal:false,cyclic:false,scrolling:"auto",width:560,height:340,autoScale:true,autoDimensions:true,centerOnScroll:false,ajax:{},swf:{wmode:"transparent"},hideOnOverlayClick:true,hideOnContentClick:false,overlayShow:true,overlayOpacity:0.7,overlayColor:"#777",titleShow:true,titlePosition:"float",titleFormat:null,titleFromAlt:false,transitionIn:"fade",transitionOut:"fade",speedIn:300,speedOut:300,changeSpeed:300,changeFade:"fast",easingIn:"swing",easingOut:"swing",showCloseButton:true,showNavArrows:true,enableEscapeButton:true,enableKeyboardNav:true,onStart:function(){},onCancel:function(){},onComplete:function(){},onCleanup:function(){},onClosed:function(){},onError:function(){}};B(document).ready(function(){B.fancybox.init()})})(jQuery);