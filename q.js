/*
 * q.js v2018.3-6.1
 * http://anonsw.github.io/8chjs/
 */

//IMAGE BLACKLIST CODING
var imageBlacklist = [] ;
function loadImageBlacklist() { JSON.parse(localStorage.imageBlacklist || "[]").forEach(addToImageBlaclist); }
function saveImageBlacklist() { localStorage.imageBlacklist = JSON.stringify(imageBlacklist); }
function addToImageBlaclist(md5) { if (md5 && -1 === imageBlacklist.indexOf(md5)) imageBlacklist.push(md5); }
function blacklistPostImages(post) { $(post).find('img.post-image').each(function (i, el) { var md5 = el.getAttribute('data-md5'); addToImageBlaclist(md5); el.remove(); }); }
function removeBlacklistedImages() { var removed = 0; $('img.post-image').each(function (i, el) { if (-1 !== imageBlacklist.indexOf(el.getAttribute('data-md5'))) { el.remove(); removed += 1; } }); return removed; }
function onNopeClicked(event) { event.preventDefault(); event.stopPropagation(); loadImageBlacklist(); var post = $(event.target).closest('.post'); blacklistPostImages(post); removeBlacklistedImages(); saveImageBlacklist(); }
function addNopeButtons() { $('.post').each(function(i, post) { if ($(post).find('.nope').length === 0) { $(post).prepend("<input type='button' class='nope' onClick='onNopeClicked(event)' value='Nope'></input>"); } }) }

setInterval(function () { loadImageBlacklist(); removeBlacklistedImages(); addNopeButtons(); }, 500);


/* Display a replies counter overlay in the top right corner */
$(function(){
  $('head').append('<style>#thread_stats_posts_ovl { '+
  'position:fixed;top:35px;right:35px;'+
  'font:38px sans-serif;opacity:0.5;color:#f60;}</style>');
  $('body').append('<div id="thread_stats_posts_ovl"/>');
  function copyStats() { $('#thread_stats_posts_ovl').
    text($('#thread_stats_posts').text());}
  $(document).on('new_post',copyStats); copyStats();});

// User Settings
var anonsw = {
    qflair: '', // Examples: REAL, &rarr;
    qcolor: '#99d6ff',
    youcolor: '#F3D74D',
    scrollcolor: 'rgba(153, 153, 153, 0.6)',
    scrollbackcolor: '#333',
    scrolltime: 400, // ms
    updateDelay: 200, // ms
    sidenavWidth: 30, // px

    floodEnabled: false,
    floodThreshold: 15, // min # posts before beginning fade
    floodVanish: 25, // max # posts before completed fade/hide
    floodBehavior: 'fade', // hide, fade
    fadenametripregex: /^(Anon(ymous)?-.*|.*-!!Hs1Jq13jV6)$/i,
    fadenametripfloodvalue: -1, // Effective post count for fading, or -1 for auto of floodThreshold+post count
    strikeThroughNameFags: true,

    rateHistoryLen: 50, // Data points on chart
    rateAvgLen: 10 // Number of data points to average for instantaneous rate

    // Suggestions from 589388.html#590283
    //    ...shill detection features, such as
    //          easily knowing the proportion of posts from a user that don't link.
    //          I'd want to know any ID that was posting > 1/3 posts targetting noone.

    // TODO: Behavior for post hover should be to show original post visual before all q.js mods
    // TODO: Add flags to turn on/off features
    // TODO: Custom-regex -> post color/fade (auto-filter by selecting text and choosing new menu item?)
    //       Examples: daily reminder, guys, check this out, shill, get out, filtered, tell us more, archive everything
    // TODO: Manual shade
    // TODO: remove Q trip codes from post content?
    // TODO: remove Q from end of post content if not a Q post?
    // TODO: recognize all of known Q trip codes? (make to sure to exclude known comps)
    // TODO: Links to reset on current Q/(you) post
    // TODO: Link to go to latest post (end key doesn't always work, but try capturing that as well?)
    // TODO: Keyboard shortcuts for navigation
    // TODO: Current/Total overall post navigation
    // TODO: Remap end key to always go to end of page
    // TODO: Check box for each post to mark as "read", "spam", ?
    // TODO: Autocorrect all-caps posts (50% threshold)?
    // TODO: Correct broken links but remove referral when clicked?
    // TODO: Make flood post fading non-linear to give leniency to posters just passing flood threshold
    // TODO: Penalize reposts in flood detection (if id's different, merge?) ?
    // TODO: Scorecard of posters ordered by post count (post rate, reply count, ...)?
    // TODO: Color/shade posts where there are no references and no question marks
    // TODO: If Q or trip used in name field, strike them out or replace with Anonymous?
    // TODO: embedded posts in Q posts don't have background-color and inherit Q color, fix?
};

(function( anonsw_main, $, undefined ) {
    // House keeping variables
    var qposts = [];
    var allqposts = [];
    var currq = -1;
    var youposts = [];
    var curryou = -1;
    var qnavposts = [];
    var younavposts = [];
    var ctx;
    var	borderSz;
    var	scrollWd;
    var minheight;
    var ratehistory = [];

    // On scroll stop. SO #9144560
    (function ($) {
        var on = $.fn.on, timer;
        $.fn.on = function () {
            var args = Array.apply(null, arguments);
            var last = args[args.length - 1];

            if (isNaN(last) || (last === 1 && args.pop())) return on.apply(this, args);

            var delay = args.pop();
            var fn = args.pop();

            args.push(function () {
                var self = this, params = arguments;
                clearTimeout(timer);
                timer = setTimeout(function () {
                    fn.apply(self, params);
                }, delay);
            });

            return on.apply(this, args);
        };
    }(this.jQuery || this.Zepto));

    // Case insensitive contains selector for finding yous. SO #8746882
    $.expr[":"].icontains = jQuery.expr.createPseudo(function (arg) {
        return function (elem) {
            return jQuery(elem).text().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
        };
    });

    // Get non-child text. SO #3442394
    function immediateText(el) {
        return el.contents().not(el.children()).text();
    }

    // Scroll to element
    function myScrollTo(el) {
        $('html, body').animate({
            scrollTop: $(el).offset().top - $('div.boardlist').height()
        }, anonsw.scrolltime);
    }

    // Highlight (you) posts/references
    function highlightYous() {
        $(youposts).each(function() {
            $(this).css('background-color', anonsw.youcolor);
        });
        return $.Deferred().resolve();
    }

    // Remove invalid (you)'s
    function removeInvalidYous() {
        $('div.body:icontains("(You)")').each(function() {
            $(this).find(':not(small)').contents().filter(function() { return this.nodeType == 3 }).each(function() {
                this.textContent = this.textContent.replace(/\(+ *You *\)+/ig, "you");
            });
        });
        return $.Deferred().resolve();
    }

    // Highlight Q posts
    function highlightQ() {
        $(allqposts).each(function(idx,val) {
            if($(val).css('background-color') !== anonsw.qcolor) {
                if(anonsw.qflair !== "") {
                    $(val).find('p.intro > label > span.trip').first().prepend(anonsw.qflair + " ");
                }
                $(val).css('background-color', anonsw.qcolor);
            }
        });
        return $.Deferred().resolve();
    }

    // Scroll to next Q
    anonsw_main.nextq = function() {
        if(qposts.length > 0) {
            if(currq < qposts.length-1) {
                currq++;
            }
            myScrollTo($(qposts).get(currq));
        }
    };

    // Scroll to last Q
    anonsw_main.lastq = function() {
        if(qposts.length > 0) {
            currq = qposts.length - 1;
            myScrollTo($(qposts).get(currq));
        }
    };

    // Scroll to previous Q
    anonsw_main.prevq = function() {
        if(qposts.length > 0) {
            if(currq > 0) {
                currq--;
            }
            myScrollTo($(qposts).get(currq));
        }
    };

    // Scroll to first Q
    anonsw_main.firstq = function() {
        if(qposts.length > 0) {
            currq = 0;
            myScrollTo($(qposts).get(currq));
        }
    };

    // Scroll to next (You)
    anonsw_main.nextyou = function() {
        if(youposts.length > 0) {
            if(curryou < youposts.length-1) {
                curryou++;
            }
            myScrollTo($(youposts).get(curryou));
        }
    };

    // Scroll to last (You)
    anonsw_main.lastyou = function() {
        if(youposts.length > 0) {
            curryou = youposts.length - 1;
            myScrollTo($(youposts).get(curryou));
        }
    };

    // Scroll to previous (You)
    anonsw_main.prevyou = function() {
        if(youposts.length > 0) {
            if(curryou > 0) {
                curryou--;
            }
            myScrollTo($(youposts).get(curryou));
        }
    };

    // Scroll to first (You)
    anonsw_main.firstyou = function() {
        if(youposts.length > 0) {
            curryou = 0;
            myScrollTo($(youposts).get(curryou));
        }
    };

    // Inserts Q navigation links
    function qnav() {
        $('div.boardlist').append('<span>[ <a href="javascript:anonsw_main.firstq();"><i class="fa fa-step-backward"></i></a> <a href="javascript:anonsw_main.prevq();"><i class="fa fa-backward"></i></a> <span style="filter:brightness(70%);">Q</span> <span class="qcount">(?:?)</span> <a href="javascript:anonsw_main.nextq();"><i class="fa fa-forward"></i></a> <a href="javascript:anonsw_main.lastq();"><i class="fa fa-step-forward"></i></a> ]</span>');
    }

    // Inserts (You) navigation links
    function younav() {
        $('div.boardlist').append('<span>[ <a href="javascript:anonsw_main.firstyou();"><i class="fa fa-step-backward"></i></a> <a href="javascript:anonsw_main.prevyou();"><i class="fa fa-backward"></i></a> <span style="filter:brightness(70%);">(You)</span> <span class="youcount">(?:?)</span> </span><a href="javascript:anonsw_main.nextyou();"><i class="fa fa-forward"></i></a> <a href="javascript:anonsw_main.lastyou();"><i class="fa fa-step-forward"></i></a> ]</span>');
    }

    // Inserts feature toggle links
    function togglenav() {
        $('div.boardlist').append('<span>[ <a href="javascript:anonsw_main.toggleFlood();">Turn Post Fading <span class="toggleFloodState">Off</span></a> ]</span>')
    }

    // Inserts post rate count/chart
    function postratenav() {
        var height = $('div.boardlist').height() - 1;
        $('div.boardlist').append('<span>[ Post Rate: <span class="postRate">0</span> posts/min <canvas class="postRateChart"></canvas>]</span>')
        $('.postRate').css('color', $('div.boardlist a').css('color'));
        var charts = $('.postRateChart');
        $(charts).each(function() {
            $(this).css('width', '100px');
            $(this).css('height', height);
            $(this).css('vertical-align', 'middle');
            //$(this).css('border', '1px solid');
            //$(this).css('border-color', $('div.boardlist').css('color'));
            var gctx = $(this).get(0).getContext('2d');
            gctx.canvas.height = 20;
            gctx.canvas.width = 100;
        });
    }

    // Inserts side navigation (bird's eye)
    function sidenav() {
        $('body').append('<canvas id="sidenav"></canvas>');
        var nav = $('#sidenav');
        $(nav).css('position', 'fixed');
        $(nav).css('top', $('div.boardlist').height());
        $(nav).css('right', 0);
        $(nav).css('width', anonsw.sidenavWidth);
        $(nav).css('height', $(window).height() - $('div.boardlist').height());
        $(nav).css('background-color', anonsw.scrollbackcolor);
        $('body').css('margin-right', anonsw.sidenavWidth);
        ctx = $('#sidenav').get(0).getContext('2d');
        //ctx.canvas.height = $(document).height() - $('div.boardlist').height();
        ctx.canvas.height = 2048;
        ctx.canvas.width = anonsw.sidenavWidth;
        borderSz = 1;
        scrollWd = ctx.canvas.width / 2;
    }

    // Update navigation counts
    function updateNavCounts() {
        var fontSize = -1;
        var lineHeight;

        if(currq > qposts.length) { currq = qposts.length; }
        if(curryou > youposts.length) { curryou = youposts.length; }

        for(i=0; i<qposts.length; i++) {
            var el = $(qposts).get(i);
            if(fontSize == -1) {
                fontSize = $(el).css('font-size');
                lineHeight = Math.floor(parseInt(fontSize.replace('px', '')) * 1.5);
            }
            if(($(el).offset().top + $(el).height() - 2.25*lineHeight) > $(window).scrollTop()) {
                currq = i;
                break;
            }
        }

        for(i=0; i<youposts.length; i++) {
            var el = $(youposts).get(i);
            if(fontSize == -1) {
                fontSize = $(el).css('font-size');
                lineHeight = Math.floor(parseInt(fontSize.replace('px', '')) * 1.5);
            }
            if(($(el).offset().top + $(el).height() - 2.25*lineHeight) > $(window).scrollTop()) {
                curryou = i;
                break;
            }
        }

        // TODO: check for duplicates and remove from counts
        $('.qcount').text("(" + (currq+1) + ":" + qposts.length + ")");
        $('.youcount').text("(" + (curryou+1) + ":" + youposts.length + ")");
    }

    // Update navigation graphics
    function updateNavGraphics() {
        var sidenav = $('#sidenav');
        if(sidenav.length) {
            $(sidenav).css('height', $(window).height() - $('div.boardlist').height());
            minheight = ctx.canvas.height / ($(window).height() - $('div.boardlist').height()); // 1px
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

            // Draw nav q posts
            qnavposts = [];
            ctx.fillStyle = anonsw.qcolor;
            for (i = 0; i < qposts.length; i++) {
                // TODO: check if we have already added post, don't draw it again
                var el = $(qposts).get(i);
                var height = $(el).height() / $(document).height() * ctx.canvas.height;
                if(height < minheight) height = minheight;
                qnavposts[i] = {
                    x : borderSz,
                    y : $(el).offset().top / $(document).height() * ctx.canvas.height,
                    width : ctx.canvas.width - borderSz*2,
                    height : height
                };
                ctx.fillRect(qnavposts[i].x, qnavposts[i].y, qnavposts[i].width, qnavposts[i].height);
            }

            // Draw nav you posts
            younavposts = [];
            ctx.fillStyle = anonsw.youcolor;
            for (i = 0; i < youposts.length; i++) {
                // TODO: check if we have already added post, don't add it again
                var el = $(youposts).get(i);
                var height = $(el).height() / $(document).height() * ctx.canvas.height;
                if(height < minheight) height = minheight;
                younavposts[i] = {
                    x : borderSz,
                    y : $(el).offset().top / $(document).height() * ctx.canvas.height,
                    width : ctx.canvas.width - borderSz*2,
                    height : height
                };
                ctx.fillRect(younavposts[i].x, younavposts[i].y, younavposts[i].width, younavposts[i].height);
            }

            // Update nav window
            ctx.fillStyle = anonsw.scrollcolor;
            ctx.fillRect(
                scrollWd / 2,
                $(window).scrollTop() / $(document).height() * ctx.canvas.height,
                scrollWd,
                $(window).height() / $(document).height() * ctx.canvas.height
            );

            // Add red marker at bottom of >750 posts
            if($('#thread_stats_posts').text() > 750) {
                var barHeight = (4 * 2048) / ($(window).height() - $('div.boardlist').height());
                ctx.fillStyle = '#f66';
                ctx.fillRect(
                    0,
                    ctx.canvas.height - barHeight,
                    ctx.canvas.width,
                    barHeight
                );
            }
        }
    }

    // Updates post rate count/chart
    function updateNavPostRate() {
        var posts = $('div.post').not('.post-hover');
        var startPost = posts.length - (anonsw.rateHistoryLen + anonsw.rateAvgLen) + 1;
        if(startPost < 1) startPost = 1;
        var start = $($($(posts).get(0)).find('.intro time').get(0)).attr('unixtime'); //$('div.post:first .intro time').attr('unixtime');
        ratehistory = [];
        timehistory = [];
        for(var i=startPost; i<posts.length; i++) {
            // TODO: check if we have already added post, don't add it again
            var step = $($($(posts).get(i)).find('.intro time').get(0)).attr('unixtime'); //$($('div.post .intro time').get(i)).attr('unixtime');
            timehistory[timehistory.length] = step;
            if(timehistory.length - anonsw.rateAvgLen - 1 >= 0) {
                var avgend = timehistory[timehistory.length - 1];
                var avgstart = timehistory[timehistory.length - anonsw.rateAvgLen - 1];
                ratehistory[ratehistory.length] = anonsw.rateAvgLen / ((avgend - avgstart) / 60);
            } else {
                ratehistory[ratehistory.length] = 0;
            }
        }
        //console.log(ratehistory);

        $('.postRate').text(ratehistory[ratehistory.length-1].toFixed(1));

        if(ratehistory.length > anonsw.rateAvgLen) {
            var maxRate = Math.max.apply(null, ratehistory);
            var minRate = Math.min.apply(null, ratehistory);
            //console.log("Max: " + maxRate);
            //console.log("Min: " + minRate);
            if(minRate > (maxRate - 0.5)) {
                minRate = maxRate - 0.5;
                maxRate = maxRate + 0.5;
            }
            if(minRate < 0) {
                minRate = 0;
            }
            var maxTime = timehistory[timehistory.length-1];
            var minTime = timehistory[anonsw.rateAvgLen];
            $('.postRateChart').each(function() {
                var gctx = $(this).get(0).getContext('2d');
                gctx.clearRect(0, 0, gctx.canvas.width, gctx.canvas.height);
                gctx.strokeStyle = $('div.boardlist a').css('color');
                gctx.beginPath();
                var x = 0;
                var y = gctx.canvas.height - (ratehistory[anonsw.rateAvgLen] - minRate)/(maxRate - minRate) * gctx.canvas.height;
                gctx.moveTo(x, y);
                for(var i=anonsw.rateAvgLen+1; i<ratehistory.length; i++) {
                    x = (timehistory[i] - minTime)/(maxTime - minTime) * gctx.canvas.width;
                    y = gctx.canvas.height - (ratehistory[i] - minRate)/(maxRate - minRate) * gctx.canvas.height;
                    gctx.lineTo(x, y);
                }
                gctx.stroke();
                gctx.closePath();
            });
        }
    }

    // Update navigation
    function updateNav() {
        updateNavCounts();
        updateNavGraphics();
        updateNavPostRate();
    }

    // Update nav when scrolling stops
    $(window).on('scroll', function(e) {
        updateNavCounts();
        updateNavGraphics();
    }, anonsw.updateDelay);

    // Update nav when resize stops
    $(window).on('resize', function(e) {
        updateNav();
    }, anonsw.updateDelay);

    // Set which posts are Q posts
    function setQPosts() {
        qposts = $.map($('div.post:not(.post-hover) > p.intro > label > span.trip:contains("!!Hs1Jq13jV6")'), function(el) {
            return $(el).closest('div.post');
        });
        allqposts = $.map($('div.post:not(.post-hover) > p.intro > label > span.trip:contains("!!Hs1Jq13jV6")'), function(el) {
            return $(el).closest('div.post');
        });
        return $.Deferred().resolve();
    }

    // Set which posts are (you) posts
    function setYouPosts() {
        youposts = $.map($('div.post:not(.post-hover) > p.intro > label span.name > span.own_post, div.post:not(.post-hover) > div.body > p.body-line > small:icontains("(You)")'), function(el) {
            return $(el).closest('div.post');
        });
        return $.Deferred().resolve();
    }

    // Set flood posts
    function setFloodPosts() {
        if(anonsw.floodEnabled) {
            var stats = {};
            var firstId = null;
            //console.log("==[ Name Fags ]=================================================");
            var posts = $('div.post:not(.post-hover)').not('.you');
            $(posts).each(function () {
                var id = $(this).find('p > span.poster_id').first().text();
                if(firstId != null) {
                    if (!(id in stats)) {
                        stats[id] = {count: 0, namefag: false, floodcount: 0};
                    }
                    stats[id].count++;
                    if(!stats[id].namefag) {
                        var name = immediateText($(this).find('p > label span.name').first());
                        var trip = $(this).find('p > label > span.trip').first().text();
                        stats[id].namefag = !anonsw.fadenametripregex.test(name+'-'+trip);
                        //if(stats[id].namefag) {
                        //	console.log(id + '=' + stats[id].namefag + ', ' + name + ', ' + trip);
                        //}
                    }
                    if(stats[id].namefag) {
                        if(anonsw.fadenametripfloodvalue < 0) {
                            stats[id].floodcount = anonsw.floodThreshold + stats[id].count;
                        } else {
                            stats[id].floodcount = anonsw.fadenametripfloodvalue;
                        }
                    } else {
                        stats[id].floodcount = stats[id].count;
                    }
                }
                if (firstId == null) {
                    firstId = id;
                }
            });
            $.each(stats, function (key, value) {
                if (key !== firstId) {
                    var ids = $('span.poster_id:contains("' + key + '")');
                    if (value.floodcount > anonsw.floodThreshold || value.namefag) {
                        if(anonsw.strikeThroughNameFags && value.namefag) {
                            $(ids).each(function() {
                                $(this).closest('div.post').find('p > label span.name').first().css('text-decoration','line-through');
                            });
                        }
                        if (anonsw.floodBehavior === 'fade') {
                            var intensity = value.floodcount;
                            if (intensity > anonsw.floodVanish) {
                                intensity = anonsw.floodVanish;
                            }
                            intensity = ((anonsw.floodVanish - anonsw.floodThreshold) - (intensity - anonsw.floodThreshold)) / (anonsw.floodVanish - anonsw.floodThreshold);
                            if (intensity < 0.1) {
                                intensity = 0.1;
                            }
                            $(ids).each(function () {
                                $(this).closest('div.post').css('opacity', intensity);
                                $(this).closest('div.post').hover(function () {
                                    $(this).animate({opacity: 1.0}, anonsw.updateDelay);
                                }, function () {
                                    $(this).animate({opacity: intensity}, anonsw.updateDelay);
                                });
                            });
                        } else if (anonsw.floodBehavior === 'hide') {
                            if (value.count >= anonsw.floodVanish) {
                                $(ids).each(function () {
                                    $(this).closest('div.post').hide();
                                });
                            }
                        }
                    } else {
                        $(ids).each(function () {
                            $(this).closest('div.post').css('opacity', 1.0);
                        });
                    }
                }
            });
        }
        return $.Deferred().resolve();
    }

    // Toggle post flooding
    anonsw_main.toggleFlood = function() {
        if(anonsw.floodEnabled) {
            anonsw.floodEnabled = false;
            $('.toggleFloodState').text('On');
            if(anonsw.floodBehavior === 'fade') {
                $('span.poster_id').each(function () {
                    $(this).closest('div.post').css('opacity', 1);
                    $(this).closest('div.post').off('mouseenter mouseleave');
                });
            } else if(anonsw.floodBehavior === 'hide') {
                $(this).closest('div.post').show();
            }
        } else {
            anonsw.floodEnabled = true;
            $('.toggleFloodState').text('Off');
            runq()
        }
    };

    // Helper to run snippets in the right order
    function runq() {
        setQPosts()
            .done(highlightQ)
            .done(removeInvalidYous)
            .done(setYouPosts)
            .done(highlightYous)
            .done(setFloodPosts)
            .done(updateNav);
    }

    anonsw_main.Q = function() {
        qnav();
        younav();
        togglenav();
        postratenav();
        sidenav();
        runq();

        // Select the node that will be observed for mutations
        var targetNode = $('div.thread')[0];

        // Options for the observer (which mutations to observe)
        var config = { childList: true };

        // Callback function to execute when mutations are observed
        var callback = function(mutationsList) {
            for(var mutation in mutationsList) {
                if (mutationsList[mutation].type == 'childList') {
                    runq();
                    break;
                }
            }
        };

        // Create an observer instance linked to the callback function
        var observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);
    };
}( window.anonsw_main = window.anonsw_main || {}, jQuery ));

// Attach snippets to ready/change events
$(document).ready(anonsw_main.Q);