jQuery(function($) {
	// User Settings
	// To override some or all of these settings you can set them in the 8kun
	// "Options > User JS" box like this:
	/*

window.qjsSettings = {
  youcolor: '#ffffbb',
};

// You can also override settings for specific boards:

window.qjsSettings = {
  youcolor: '#ffffbb',
  boards: {
    qrb: {
      youcolor: '#334455',
    },
  },
};

	*/
	// It's better to change the settings this way, WITHOUT modifying this
	// script's code, because that way it's easier to update to new versions
	// later!

	var defaultSettings = {
		qflair: '', // Examples: REAL, &rarr;
		qcolor: '#99d6ff',
		youcolor: '#F3D74D',
		scrollcolor: 'rgba(255, 255, 255, 0.9)',
		scrollcolor2: 'rgba(255, 255, 255, 0.6)', // may enlarge scroll bar for visibility
		scrollminheight: 9,
		scrollbackcolor: '#333',
		offbreadcolor: '#ffb', // background for posts in other breads
		// background for the current post link when showing a quoted post via hover
		quotehovercolor: '#ebf',
		scrolltime: 0, // ms
		// youscrollcolor: (same as 'youcolor' by default),
		updateDelay: 30, // ms
		sidenavWidth: 30, // px

		floodEnabled: false,
		floodThreshold: 15, // min # posts before beginning fade
		floodVanish: 25, // max # posts before completed fade/hide
		floodBehavior: 'fade', // hide, fade
		fadenametripregex: /^(Anon(ymous)?-.*|.*-!!Hs1Jq13jV6)$/i,
		fadenametripfloodvalue: -1, // Effective post count for fading, or -1 for auto of floodThreshold+post count
		strikeThroughNameFags: false, // doesn't work well with other boards!

		rateHistoryLen: 50, // Data points on chart
		rateAvgLen: 10, // Number of data points to average for instantaneous rate

		extraStyles: '',

		boards: {
			qrb: {
				youcolor: '#2a3a4a',
				youscrollcolor: '#4a6376',
				offbreadcolor: '#480000',
				quotehovercolor: '#705',
				extraStyles: `
.post > div.qjs-controls a {
  color: #ddaadd;
}
.body small {
  color: #339955;
}
span.qjs-pastebin {
  color: #c5c8c6;
  border-color: rgba(197, 200, 198, 0.6);
}
span.qjs-pastebin a {
  color: #f33 !important;
}
`,
			},
			abcu: { // overuses !important in board styles
				youcolor: '#f3e77d !important',
				youscrollcolor: '#f3e77d',
				scrollbackcolor: 'rgba(51, 51, 51, 0.75)',
				extraStyles: `
.desktop-style div.boardlist:not(.bottom), .boardlist:hover {
  opacity: 1;
  background: rgb(195,225,255) !important;
  color: #cc0000 !important;
}
.qjs-overlay {
  color: #cc3333;
}
				`,
			},
		},
	};

	var qjs_main = window.qjs_main = window.qjs_main || {};
	qjs_main.defaultSettings = defaultSettings;

	// House keeping variables
	var boardName = window.location.pathname.match(/\/([^\/]+)\//)[1];
	var opPostId = window.location.href.match(/\/(\d+)\.html/)[1];
	var qposts = [];
	var currq = -1;
	var youposts = [];
	var curryou = -1;
	var qnavposts = [];
	var younavposts = [];
	var postIdsByIndex = {};
	var ctx;
	var borderSz;
	var minheight;
	var ratehistory = [];
	var floodEnabled = getSetting('floodEnabled');
	var postCount = 0;
	var navScaleFactor = 3;
	var isCyclical = $('.post.op .fa.fa-refresh').length > 0;

	function getSetting(name) {
		var s = window.qjsSettings;
		if (s && s.boards && boardName && s.boards[boardName] && name in s.boards[boardName]) {
			return s.boards[boardName][name];
		}
		if (s && name in s) {
			return s[name];
		}
		if (boardName && defaultSettings.boards[boardName] && name in defaultSettings.boards[boardName]) {
			return defaultSettings.boards[boardName][name];
		}
		return defaultSettings[name];
	}
	qjs_main.getSetting = getSetting;

	// Suggestions to consider for future development
	// from 589388.html#590283 ...shill detection features, such as
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

	var $allPosts = null;
	var autoUpdateInterval;
	var autoUpdateFinishedCount = 0;

	// Image blacklist and Nope links
	var imageBlacklist = {};

	function loadImageBlacklist() {
		Object.keys(JSON.parse(localStorage.imageBlacklistHash || "{}"))
			.forEach(addToImageBlacklist);
	}
	loadImageBlacklist();

	function saveImageBlacklist() {
		localStorage.imageBlacklistHash = JSON.stringify(imageBlacklist);
	}

	function addToImageBlacklist(md5) {
		if (md5) {
			imageBlacklist[md5] = true;
		}
	}

	function findFileParent(img) {
		// For videos the DOM structure is .files > .file > { .fileinfo, .file }
		// For images it's .files > .file > { .fileinfo, a }
		// WTF...
		var $file = $(img).closest('.file');
		var $file2 = $file.parent().closest('.file');
		return $file2.length ? $file2 : $file;
	}

	function blacklistPostImages(post, undo) {
		$(post).find('img.post-image').each(function() {
			var md5 = this.getAttribute('data-md5');
			if (undo) {
				delete imageBlacklist[md5];
				findFileParent(this).removeClass('blacklisted');
			} else {
				addToImageBlacklist(md5);
				findFileParent(this).addClass('blacklisted');
			}
		});
		updateBlacklistedCount(post);
	}

	function updateBlacklistedCount(post) {
		var $post = $(post);
		var blacklistedCount = $post.find('.file.blacklisted').length;
		// note: may be more than 1 '.file' element
		var totalCount = $post.find('.fileinfo').length;
		$post.find('.qjs-blacklist-count').text(
			blacklistedCount
				? ' | ' + blacklistedCount + '/' + totalCount + ' :blacklisted'
				: ''
		);
	}

	function addPostControls() {
		// Must iterate over all posts here, to get the correct index
		$allPosts.each(function(i, el) {
			if (!el.classList.contains('qjs-processed-controls')) {
				$(el).prepend(
					'<div class="qjs-controls">'
					+ '[#' + i + '] '
					+ '<a class="qjs-hide" href="#">:hide</a>'
					+ '<span class="qjs-blacklist-count"></span>'
					+ '</div>'
				);
				// see: "Don't scroll to my own new posts" section below
				postIdsByIndex[i] = el.id.replace(/^disabled_/, '');
				el.classList.add('qjs-processed-controls');
			}
		});
	}

	function removeBlacklistedImages() {
		$allPosts.filter(':not(.qjs-processed-images)').each(function() {
			var blacklistedAny = false;
			$('img.post-image', this).each(function() {
				if (imageBlacklist[this.getAttribute('data-md5')]) {
					blacklistedAny = true;
					findFileParent(this).addClass('blacklisted');
				}
			});
			if (blacklistedAny) {
				updateBlacklistedCount(this);
			}
			this.classList.add('qjs-processed-images');
		});
	}

	function addPostNumberSpacesForElement(el, isMention) {
		var $el = $(el);
		var postNumber = $el.text();
		var pieces = [];
		var prefix = postNumber.replace(/\d+$/, '');
		var numbersOnly = postNumber.substring(prefix.length);
		if (!numbersOnly) {
			// may be a link directly to a board like >>>/abcu/ - ignore
			return;
		}
		while (numbersOnly.length % 3 !== 0) numbersOnly = ' ' + numbersOnly;
		for (var i = 0; i < numbersOnly.length / 3; i++) {
			pieces.push(numbersOnly.substring(i * 3, i * 3 + 3).trim());
		}
		if (prefix) {
			pieces[0] = prefix + pieces[0];
		}
		var tagOpen = '<span class="qjs-postnum-part">';
		var tagClose = '</span>';
		$el.html(tagOpen + pieces.join(tagClose + tagOpen) + tagClose);
		if (isMention) {
			$el.addClass('qjs-processed-postnums');
		}
	}

	function addPostNumberSpaces() {
		$allPosts.filter(':not(.qjs-processed-postnums)').each(function() {
			var sels = [
				'.post_no:not([id^="post_no"])',
				'.body-line a[onclick^="highlightReply("]',
				'.body-line a[href^="/"]',
			];
			$(this).find(sels.join(', ')).each(function() {
				addPostNumberSpacesForElement(this);
			});
			this.classList.add('qjs-processed-postnums');
		});
		// Process quoted posts that appear during an update
		$allPosts.find('.mentioned > a:not(.qjs-processed-postnums)').each(function() {
			addPostNumberSpacesForElement(this, true);
		});
	}

	function fixAutoUpdates() {
		if ($allPosts.length < 700) {
			return;
		}
		if (autoUpdateInterval) {
			return;
		}
		if (!$('#auto_update_status').prop('checked')) {
			return;
		}

		var reenableAutoUpdateLimit = 600;
		var isArtificialClick = false;

		function enableAutoUpdateCheck() {
			autoUpdateInterval = setInterval(function() {
				if (!$('#auto_update_status').prop('checked')) {
					var reenablePercent = Math.min(
						100,
						Math.round(100 * autoUpdateFinishedCount / reenableAutoUpdateLimit)
					);
					console.log('re-enabling auto update (' + reenablePercent + '%)');
					isArtificialClick = true;
					$('#auto_update_status').click();
					isArtificialClick = false;
				}
				if ($allPosts.length >= 751) {
					autoUpdateFinishedCount++;
					if (autoUpdateFinishedCount >= reenableAutoUpdateLimit) {
						clearInterval(autoUpdateInterval);
						autoUpdateInterval = null;
						console.log('auto-update check disabled (expired)');
					}
				}
			}, 600);
		}
		enableAutoUpdateCheck();

		$('#auto_update_status').on('click', function() {
			if (isArtificialClick) {
				return;
			}
			if ($(this).prop('checked')) {
				enableAutoUpdateCheck();
			} else {
				console.log('auto-update check disabled (manual)');
				clearInterval(autoUpdateInterval);
				autoUpdateInterval = null;
			}
		});
	}

	$(document).on('click', 'div.qjs-controls a.qjs-hide', function() {
		var $post = $(this).closest('.post');

		if (this.textContent === ':hide') {
			$post.addClass('qjs-hidden');
			blacklistPostImages($post);
			this.textContent = ($post.find('.file').length ? ':show-text' : ':show');

		} else if (this.textContent === ':show-text') {
			$post.removeClass('qjs-hidden');
			this.textContent = ':show';

		} else { // ':show'
			$post.removeClass('qjs-hidden');
			blacklistPostImages($post, true);
			this.textContent = ':hide';
		}

		saveImageBlacklist();
		return false;
	});

	$(document).on('mouseover', 'a.hash_unix.hash_u', function() {
		$(this).closest('.file.blacklisted').addClass('show-temp');
	}).on('mouseout', 'a.hash_unix.hash_u', function() {
		$(this).closest('.file.blacklisted').removeClass('show-temp');
	});

	// Don't scroll to my own new posts
	// Relevant 8kun code:
	// highlightReply(post_response.id);
	// window.location.hash = post_response.id;
	// var scroll_reply = $('div.post#reply_' + post_response.id);
	// if (scroll_reply.length) {
	//   $(window).scrollTop(scroll_reply.offset().top);
	// }
	var enableHighlightReply = true;
	window.highlightReplyOrig = window.highlightReply;
	window.highlightReply = function(id, event) {
		if (enableHighlightReply) {
			return window.highlightReplyOrig.call(this, id, event);
		} else {
			enableHighlightReply = true;
			var $post = $('div.post#reply_' + id);
			var $anchor = $('#' + id);
			// Disable scroll_reply in 8kun code
			$post.attr('id', 'disabled_reply_' + id);
			// Disable window.location.hash in 8kun code
			$anchor.attr('id', 'disabled_' + id);
			setTimeout(function() {
				// Restore normal function
				$post.attr('id', 'reply_' + id);
				$anchor.attr('id', id);
			}, 0);
			// Show a notice
			var $myPost = $('<div class="qjs_my_post">')
				.data('created', Date.now())
				.data('expires', Date.now() + 60000);
			var $newPostIndicator = $('<a>')
				.text('>>' + id)
				.attr('href', '#' + id)
				.attr('onclick', 'highlightReply(' + JSON.stringify(id) + ', event)')
			$myPost.append($newPostIndicator);
			addPostNumberSpacesForElement($newPostIndicator);
			$myPost.append(
				$('<span>')
					.text(' ' + $post.find('time').text().trim().split(' ')[2])
			);
			$('#qjs_my_posts').append($myPost);
			fadeMyPosts();
			// Don't highlight multiple posts that were just loaded
			// TODO why does this happen?
			$('.post.highlighted').removeClass('highlighted');
		}
	};
	$(document).ajaxSuccess(function(event, xhr, settings) {
		if (settings.url === 'https://sys.8kun.top/post.php') {
			enableHighlightReply = false;
		}
	});
	function fadeMyPosts() {
		var $myPosts = $('.qjs_my_post');
		if (!$myPosts.length) {
			return;
		}
		$myPosts.each(function() {
			var $this = $(this);
			if (Date.now() >= $this.data('expires')) {
				$this.remove();
			} else {
				var ratio = (
					($this.data('expires') - Date.now())
					/ ($this.data('expires') - $this.data('created'))
				);
				$this.css('opacity', 0.3 + 0.6 * ratio);
			}
		});
		setTimeout(fadeMyPosts, 600);
	}

	if (/\/res\/\d+.html/.test(window.location.href)) {
		// Fix reply citing: don't reset textarea scroll position or cursor position
		// To make this simpler, and also fix the quick reply box not appearing:
		// use the quick reply box only
		$(window).trigger('cite');
		// Disable hide_at_top - relevant 8kun code:
		// if ($(this).scrollTop() < $origPostForm.offset().top + $origPostForm.height() - 100) {
		//   $postForm.fadeOut(100);
		// }
		$('form[name="post"]:first').css({
			display: 'block',
			position: 'absolute',
			top: '-900px',
		});
		// Fix close-btn behavior
		$('#quick-reply .close-btn').off('click');
		$('#quick-reply .close-btn').on('click', function() {
			$('#quick-reply #post-form-inner').hide();
		});
		// Fix [Post a Reply] button behavior
		$('#link-quick-reply').off('click');
		$('#link-quick-reply').on('click', function() {
			$('#quick-reply #post-form-inner').show();
			$('#quick-reply textarea[name=body]').focus();
			return false;
		});
		// Hide reply box until it's needed
		// but only if there are already some replies (i.e. not baking)
		if ($('.post.reply').length) {
			$('#quick-reply #post-form-inner').hide();
		}
		window.citeReply = function(id, with_link) {
			$('#quick-reply #post-form-inner').show();
			// TODO what triggers this to break?
			$('#post-form-outer textarea[name=body]').attr('id', '');
			$('#quick-reply textarea[name=body]').attr('id', 'body');
			var textarea = document.getElementById('body');
			var toInsert = '>>' + id + '\n';
			// 8kun code sets this to window.getSelection().toString()
			var selectedText = sessionStorage.quoteClipboard;
			if (selectedText) {
				toInsert += selectedText
					.split('\n')
					.map(function(line) {
						if (line !== '') {
							return '>' + line + '\n';
						} else {
							// No way to tell the difference between real empty
							// lines and end of paragraph, so skip them
							return '';
						}
					})
					.join('');
				delete sessionStorage.quoteClipboard;
			}
			var scrollTop = textarea.scrollTop;
			var insertPoint = Math.max(textarea.selectionStart, textarea.selectionEnd);
			if (insertPoint > 0) {
				insertPoint = textarea.value.indexOf('\n', insertPoint - 1);
				if (insertPoint === -1) {
					// Insertion point on last line, which doesn't have a trailing newline
					toInsert = '\n' + toInsert;
					insertPoint = textarea.value.length;
				} else {
					insertPoint++;
				}
			}
			textarea.value = (
				textarea.value.substring(0, insertPoint)
				+ toInsert
				+ textarea.value.substring(insertPoint)
			);
			textarea.selectionStart = textarea.selectionEnd = insertPoint + toInsert.length;
			textarea.scrollTop = scrollTop;
			textarea.focus();
		};
	}

	// Misc styles
	$('head').append(
`<style>
div.boardlist > span.sub > a {
	display: inline-block;
	margin: 0 -3px;
}
span.post-num {
	margin-left: 0.3em;
	opacity: 0.6;
	font-size: 81%;
}
a[href^="/${boardName}/res/"]:not([href^="/${boardName}/res/${opPostId}.html"]):not([href*="+50.html"]) {
	background: ${getSetting('offbreadcolor')};
}
a.dashed-underline {
	background: ${getSetting('quotehovercolor')};
}
span.qjs-pastebin {
	font-size: 81%;
	opacity: 0.75;
	margin-left: 0.3em;
	color: #000;
	border: 1px solid rgb(0, 0, 0, 0.6);
	border-radius: 3px;
	padding: 1px 2px;
	-moz-user-select: none;
	user-select: none;
}
span.qjs-pastebin a {
	color: #900 !important;
}
.post > div.qjs-controls {
	opacity: 0.75;
	font-size: 90%;
}
.post > div.qjs-controls a {
	color: #306;
	text-decoration: none;
}
.post > div.qjs-controls a:hover {
	color: #c33;
}
.post.qjs-hidden > .files, .post.qjs-hidden > .body {
	display: none;
}
.file.blacklisted {
	background: #999;
	padding: 0.3em 0;
	margin: 0.15em;
	opacity: 0.6;
}
.file.blacklisted:not(.show-temp) img {
	display: none;
}
.disclaimer-8kun {
	display: none !important;
}
.qjs-overlay {
	position: fixed;
	top: 36px;
	right: ${getSetting('sidenavWidth') + 6}px;
	opacity: 0.45;
	color: #f60;
	font-family: sans-serif;
	text-align: right;
	font-size: 12px;
}
#qjs_post_count {
	font-size: 36px;
}
#sidenav {
	cursor: pointer;
}
.qjs-postnum-part {
  padding-right: 0.15em;
}
.qjs-postnum-part:last-child {
  padding-right: 0;
}

/* Extra styles */
${getSetting('extraStyles')}
</style>`
	);

	/* Display a replies counter overlay in the top right corner */
	$('body').append(
		'<div id="qjs_overlay_main" class="qjs-overlay">'
		+ '<div id="qjs_post_count" />'
		+ '<div id="qjs_my_posts" />'
		+ '</div>'
	);
	var updatePostCountDelay = 30;
	function updatePostCount() {
		postCount = $('#thread_stats_posts').text();
		if (postCount) {
			postCount = +postCount;
			$('#qjs_post_count').text(postCount);
		} else {
			// waiting for 8kun code?
			setTimeout(updatePostCount, updatePostCountDelay);
			updatePostCountDelay *= 1.5;
		}
	}
	$(document).on('new_post', function() {
		setTimeout(updatePostCount, 30);
	});
	updatePostCount();

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
	}(window.jQuery));

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
		}, getSetting('scrolltime'));
	}

	// Scroll to next Q
	qjs_main.nextq = function() {
		if(qposts.length > 0) {
			if(currq < qposts.length-1) {
				currq++;
			}
			myScrollTo($(qposts).get(currq));
		}
	};

	// Scroll to last Q
	qjs_main.lastq = function() {
		if(qposts.length > 0) {
			currq = qposts.length - 1;
			myScrollTo($(qposts).get(currq));
		}
	};

	// Scroll to previous Q
	qjs_main.prevq = function() {
		if(qposts.length > 0) {
			if(currq > 0) {
				currq--;
			}
			myScrollTo($(qposts).get(currq));
		}
	};

	// Scroll to first Q
	qjs_main.firstq = function() {
		if(qposts.length > 0) {
			currq = 0;
			myScrollTo($(qposts).get(currq));
		}
	};

	// Scroll to next (You)
	qjs_main.nextyou = function() {
		if(youposts.length > 0) {
			if(curryou < youposts.length-1) {
				curryou++;
			}
			myScrollTo($(youposts).get(curryou));
		}
	};

	// Scroll to last (You)
	qjs_main.lastyou = function() {
		if(youposts.length > 0) {
			curryou = youposts.length - 1;
			myScrollTo($(youposts).get(curryou));
		}
	};

	// Scroll to previous (You)
	qjs_main.prevyou = function() {
		if(youposts.length > 0) {
			if(curryou > 0) {
				curryou--;
			}
			myScrollTo($(youposts).get(curryou));
		}
	};

	// Scroll to first (You)
	qjs_main.firstyou = function() {
		if(youposts.length > 0) {
			curryou = 0;
			myScrollTo($(youposts).get(curryou));
		}
	};

	// Inserts Q navigation links
	function qnav() {
		$('div.boardlist').append('<span>[ <a href="javascript:qjs_main.firstq();"><i class="fa fa-step-backward"></i></a> <a href="javascript:qjs_main.prevq();"><i class="fa fa-backward"></i></a> <span style="filter:brightness(70%);">Q</span> <span class="qcount">(?:?)</span> <a href="javascript:qjs_main.nextq();"><i class="fa fa-forward"></i></a> <a href="javascript:qjs_main.lastq();"><i class="fa fa-step-forward"></i></a> ]</span>');
	}

	// Inserts (You) navigation links
	function younav() {
		$('div.boardlist').append('<span>[ <a href="javascript:qjs_main.firstyou();"><i class="fa fa-step-backward"></i></a> <a href="javascript:qjs_main.prevyou();"><i class="fa fa-backward"></i></a> <span style="filter:brightness(70%);">(You)</span> <span class="youcount">(?:?)</span> </span><a href="javascript:qjs_main.nextyou();"><i class="fa fa-forward"></i></a> <a href="javascript:qjs_main.lastyou();"><i class="fa fa-step-forward"></i></a> ]</span>');
	}

	// Inserts feature toggle links
	function togglenav() {
		$('div.boardlist').append('<span>[ <a href="javascript:qjs_main.toggleFlood();">Post Fading <span class="toggleFloodState">' + (floodEnabled ? 'Off' : 'On') + '</span></a> ]</span>')
	}

	// Inserts post rate count/chart
	function postratenav() {
		var height = $('div.boardlist').height() - 1;
		$('div.boardlist').append('<span>[ Post Rate: <span class="postRate">0</span> posts/min <canvas class="postRateChart"></canvas>]</span>')
		$('.postRate').css('color', $('div.boardlist a').css('color'));
		var charts = $('.postRateChart');
		$(charts).each(function() {
			$(this).css('width', '75px');
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
	var sideNavKey = null;
	function sidenav() {
		var winHeight = $(window).height();
		var boardlistHeight = $('div.boardlist').height();
		var sideNavKeyNew = [winHeight, boardlistHeight].join(',');
		if (sideNavKey === sideNavKeyNew) {
			return; // No size change, so need to do anything now
		}
		sideNavKey = sideNavKeyNew;

		var $nav = $('#sidenav');
		if ($nav.length) $nav.remove();
		$('body').append('<canvas id="sidenav"></canvas>');
		$nav = $('#sidenav');
		$nav.css('position', 'fixed');
		$nav.css('top', $('div.boardlist').height());
		$nav.css('right', 0);
		$nav.css('width', getSetting('sidenavWidth'));
		$nav.css('height', $(window).height() - $('div.boardlist').height());
		$nav.css('background-color', getSetting('scrollbackcolor'));
		$('body').css('margin-right', getSetting('sidenavWidth'));
		ctx = $('#sidenav').get(0).getContext('2d');
		var canvasHeight = $(window).height() - $('div.boardlist').height();
		ctx.canvas.height = canvasHeight * navScaleFactor;
		ctx.canvas.width = getSetting('sidenavWidth') * navScaleFactor;
		borderSz = 1;

		var $navTooltip = null;
		var postOffsets = [];
		// https://stackoverflow.com/a/41956372
		function binarySearch(array, pred) {
			let lo = -1, hi = array.length;
			while (1 + lo < hi) {
				const mi = lo + ((hi - lo) >> 1);
				if (pred(array[mi])) {
					hi = mi;
				} else {
					lo = mi;
				}
			}
			return hi;
		}
		function updateTooltip(e) {
			hoverPostNumber = Math.max(binarySearch(postOffsets, function(o) {
				return o > e.offsetY;
			}) - 1, 0);
			$navTooltip
				.css('top', Math.min($(window).height() - 18, Math.max(e.clientY - 6, 78)) + 'px')
				.html('&rarr; #' + hoverPostNumber);
		}
		$nav.on('mouseenter', function(e) {
			var docHeight = $(document).height();
			postOffsets = $allPosts.map(function() {
				return $(this).offset().top / docHeight * canvasHeight;
			});
			$navTooltip = $('<div class="qjs-overlay">')
				.css('font-weight', 'bold')
				.css('opacity', '1')
				.appendTo('body');
			updateTooltip(e);
		}).on('mousemove', function(e) {
			updateTooltip(e);
		}).on('mouseleave', function() {
			$navTooltip.remove();
			$navTooltip = null;
		}).on('click', function(e) {
			$(window).scrollTop($('#' + postIdsByIndex[hoverPostNumber]).offset().top - 36);
		});
		updateNav();
	}

	// Update nav when scrolling stops
	$(window).on('scroll', function(e) {
		updateNavCounts();
		updateNavGraphics();
	}, getSetting('updateDelay'));

	// Update nav when resize stops
	$(window).on('resize', function(e) {
		setTimeout(sidenav, 300); // why long timeout needed?
	}, getSetting('updateDelay'));
	setInterval(sidenav, 3000); // and why is this needed?
	// but it fixes problems with the post #/offset calculation

	// Toggle post flooding
	qjs_main.toggleFlood = function() {
		if (floodEnabled) {
			floodEnabled = false;
			$('.toggleFloodState').text('On');
			if(getSetting('floodBehavior') === 'fade') {
				$('span.poster_id').each(function () {
					$(this).closest('div.post').css('opacity', 1);
					$(this).closest('div.post').off('mouseenter mouseleave');
				});
			} else if(getSetting('floodBehavior') === 'hide') {
				$(this).closest('div.post').show();
			}
		} else {
			floodEnabled = true;
			$('.toggleFloodState').text('Off');
			runq();
		}
	};

	// Helper to run snippets in the right order
	function runq() {
		$allPosts = $('div.post:not(.post-hover):not(.hidden)');

		processPastebins(); // Added later (newsbaker)
		setQPosts();
		removeInvalidYous();
		setYouPosts();
		setFloodPosts();
		updateNav();

		// Added here later (newsbaker)
		addPostControls();
		removeBlacklistedImages();
		addPostNumberSpaces();
		fixAutoUpdates();
	}

	// Try to look up pastebin author(s)
	function processPastebins() {
		$allPosts.filter(':not(.qjs-processed-pastebin)').each(function() {
			if (/pastebin\.com/.test(this.textContent)) {
				$('p.body-line', this).each(function() {
					if (this.textContent.length < 45) {
						// Pastebin URL length is 29, allow a few more chars for "dough:" etc
						var pastebinId = (this.textContent || '')
							.match(/pastebin\.com\/([a-zA-Z0-9]{8})\b/);
						pastebinId = pastebinId ? pastebinId[1] : null;
						if (pastebinId) {
							var bodyLine = this;
							function pbDone(data) {
								var msg;
								if (data.error) {
									msg = 'ERROR: ' + data.error;
								} else if (data.anonymous) {
									msg = 'anonymous';
								} else {
									msg = (
										'<a href="https://pastebin.com/u/' + data.username
										+ '" target="_blank" rel="noopener noreferer">'
										+ '/u/' + data.username
										+ '</a>'
									);
								}
								$(bodyLine).append(
									'<span class="qjs-pastebin">'
									+ ':pastebin ' + msg
									+ '</span>'
								);
							}
							$.ajax({
								url: 'https://wearethene.ws/api/dough?v=3&paste_id=' + pastebinId,
								success: function(data) {
									pbDone(data);
								},
								error: function(xhr, textStatus, errorThrown) {
									pbDone({
										error: errorThrown || textStatus || 'unknown',
									});
								},
								dataType: 'json',
							});
						}
					}
				});
			}
			this.classList.add('qjs-processed-pastebin');
		});
	}

	// Set which posts are Q posts
	function setQPosts() {
		$allPosts.filter(':not(.qjs-processed-q)').each(function() {
			var $this = $(this);
			if ($this.find('span.trip:contains("!!Hs1Jq13jV6")').length) {
				qposts.push(this);
				$this.css('background-color', getSetting('qcolor'));
				if (getSetting('qflair') !== '') {
					$this
						.find('p.intro > label > span.trip')
						.first()
						.prepend(getSetting('qflair') + ' ');
				}
			}
			this.classList.add('qjs-processed-q');
		});
	}

	// Remove invalid (you)'s
	function removeInvalidYous() {
		$allPosts.filter(':not(.qjs-processed-invalidyou)').each(function() {
			if (/\(You\)/i.test(this.textContent)) {
				$(this).find('.body :not(small)').contents().filter(function() {
					return this.nodeType === 3;
				}).each(function() {
					var text = this.textContent.replace(/\(You\)/ig, '(.You.)');
					if (text !== this.textContent) {
						this.textContent = text;
					}
				});
			}
			this.classList.add('qjs-processed-invalidyou');
		});
	}

	// Set which posts are (you) posts
	function setYouPosts() {
		$allPosts.filter(':not(.qjs-processed-you)').each(function() {
			var $this = $(this);
			if ($this.find('span.own_post, small:icontains("(You)")').length) {
				youposts.push(this);
				var youcolor = getSetting('youcolor');
				if (/!important/.test(youcolor)) {
					// Workaround for boards that have badly written styles
					// https://bugs.jquery.com/ticket/2066
					$this.css('cssText', 'background-color: ' + youcolor);
				} else {
					$this.css('background-color', youcolor);
				}
			}
			this.classList.add('qjs-processed-you');
		});
	}

	// Set flood posts
	function setFloodPosts() {
		if (floodEnabled) {
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
						stats[id].namefag = !getSetting('fadenametripregex').test(name+'-'+trip);
						//if(stats[id].namefag) {
						//	console.log(id + '=' + stats[id].namefag + ', ' + name + ', ' + trip);
						//}
					}
					if(stats[id].namefag) {
						if(getSetting('fadenametripfloodvalue') < 0) {
							stats[id].floodcount = getSetting('floodThreshold') + stats[id].count;
						} else {
							stats[id].floodcount = getSetting('fadenametripfloodvalue');
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
					if (value.floodcount > getSetting('floodThreshold') || value.namefag) {
						if(getSetting('strikeThroughNameFags') && value.namefag) {
							$(ids).each(function() {
								$(this).closest('div.post').find('p > label span.name').first().css('text-decoration','line-through');
							});
						}
						if (getSetting('floodBehavior') === 'fade') {
							var intensity = value.floodcount;
							if (intensity > getSetting('floodVanish')) {
								intensity = getSetting('floodVanish');
							}
							intensity = ((getSetting('floodVanish') - getSetting('floodThreshold')) - (intensity - getSetting('floodThreshold'))) / (getSetting('floodVanish') - getSetting('floodThreshold'));
							if (intensity < 0.1) {
								intensity = 0.1;
							}
							$(ids).each(function () {
								$(this).closest('div.post').css('opacity', intensity);
								$(this).closest('div.post').hover(function () {
									$(this).animate({opacity: 1.0}, getSetting('updateDelay'));
								}, function () {
									$(this).animate({opacity: intensity}, getSetting('updateDelay'));
								});
							});
						} else if (getSetting('floodBehavior') === 'hide') {
							if (value.count >= getSetting('floodVanish')) {
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

	// Update navigation
	function updateNav() {
		updateNavCounts();
		updateNavGraphics();
		updateNavPostRate();
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
			ctx.fillStyle = getSetting('qcolor');
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
			ctx.fillStyle = getSetting('youscrollcolor') || getSetting('youcolor');
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
			var heightScale = ctx.canvas.height / $(document).height(),
				scrollStart = $(window).scrollTop() * heightScale,
				scrollHeight = $(window).height() * heightScale,
				scrollMinHeight = getSetting('scrollminheight') * ctx.canvas.height / $(window).height();
			if (scrollHeight < scrollMinHeight) {
				var scrollStart2 = scrollStart - (scrollMinHeight - scrollHeight) / 2;
				if (scrollStart2 < 0) {
					scrollStart2 = 0;
				} else if (scrollStart2 + scrollMinHeight > ctx.canvas.height) {
					scrollStart2 = ctx.canvas.height - scrollMinHeight;
				}
				ctx.fillStyle = getSetting('scrollcolor2');
				ctx.fillRect(
					ctx.canvas.width / 4,
					scrollStart2,
					ctx.canvas.width / 2,
					scrollMinHeight
				);
			}
			ctx.fillStyle = getSetting('scrollcolor');
			ctx.fillRect(
				ctx.canvas.width / 4,
				scrollStart,
				ctx.canvas.width / 2,
				scrollHeight
			);

			// Add red marker at bottom of >750 posts
			if($('#thread_stats_posts').text() > 750 && !isCyclical) {
				var barHeight = (4 * ctx.canvas.height) / ($(window).height() - $('div.boardlist').height());
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
		var startPost = posts.length - (getSetting('rateHistoryLen') + getSetting('rateAvgLen')) + 1;
		if(startPost < 1) startPost = 1;
		var start = $($($(posts).get(0)).find('.intro time').get(0)).attr('unixtime'); //$('div.post:first .intro time').attr('unixtime');
		ratehistory = [];
		timehistory = [];
		for(var i=startPost; i<posts.length; i++) {
			// TODO: check if we have already added post, don't add it again
			var step = $($($(posts).get(i)).find('.intro time').get(0)).attr('unixtime'); //$($('div.post .intro time').get(i)).attr('unixtime');
			timehistory[timehistory.length] = step;
			if(timehistory.length - getSetting('rateAvgLen') - 1 >= 0) {
				var avgend = timehistory[timehistory.length - 1];
				var avgstart = timehistory[timehistory.length - getSetting('rateAvgLen') - 1];
				ratehistory[ratehistory.length] = getSetting('rateAvgLen') / ((avgend - avgstart) / 60);
			} else {
				ratehistory[ratehistory.length] = 0;
			}
		}
		//console.log(ratehistory);

		if (ratehistory.length) {
			$('.postRate').text(ratehistory[ratehistory.length-1].toFixed(1));
		}

		if(ratehistory.length > getSetting('rateAvgLen')) {
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
			var minTime = timehistory[getSetting('rateAvgLen')];
			$('.postRateChart').each(function() {
				var gctx = $(this).get(0).getContext('2d');
				gctx.clearRect(0, 0, gctx.canvas.width, gctx.canvas.height);
				gctx.strokeStyle = $('div.boardlist a').css('color');
				gctx.beginPath();
				var x = 0;
				var y = gctx.canvas.height - (ratehistory[getSetting('rateAvgLen')] - minRate)/(maxRate - minRate) * gctx.canvas.height;
				gctx.moveTo(x, y);
				for(var i=getSetting('rateAvgLen')+1; i<ratehistory.length; i++) {
					x = (timehistory[i] - minTime)/(maxTime - minTime) * gctx.canvas.width;
					y = gctx.canvas.height - (ratehistory[i] - minRate)/(maxRate - minRate) * gctx.canvas.height;
					gctx.lineTo(x, y);
				}
				gctx.stroke();
				gctx.closePath();
			});
		}
	}


	qjs_main.Q = function() {
		qnav();
		younav();
		togglenav();
		postratenav();
		sidenav();
		runq();

		// Scroll back to target post after qjs controls added
		setTimeout(function() {
			var hashBackup = document.location.hash;
			if (hashBackup) {
				document.location.hash = '';
				document.location.hash = hashBackup;
				$(window).scrollTop($(window).scrollTop() - 60);
			}
		}, 0);

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

	// Attach snippets to ready/change events
	// Wait for 8kun code that adds (you)s to run
	setTimeout(qjs_main.Q, 30);
});
