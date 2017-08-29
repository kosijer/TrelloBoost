var TrelloBoost = TrelloBoost || {};

// init
TrelloBoost.boardId = null;
TrelloBoost.boardTitle = null;
TrelloBoost.loaded = false;
TrelloBoost.settingsOverride = false;
TrelloBoost.$dynamicStyles = null;
TrelloBoost.settings = {};
TrelloBoost.lists = [];
TrelloBoost.projects = [];
TrelloBoost.labels = [];

TrelloBoost.util = {

	/**
	 * Converts a string to its HTML characters completely.
	 *
	 * @param {String} str String with unescaped HTML characters
	 */
	htmlEncode : function(str) {
		var buf = [];

		for (var i=str.length-1;i>=0;i--) {
			buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
		}

		return buf.join('');
	},

	/**
	 * Converts an html characterSet into its original character.
	 *
	 * @param {String} str htmlSet entities
	 */
	htmlDecode : function(str) {
		return str.replace(/&#(\d+);/g, function(match, dec) {
			return String.fromCharCode(dec);
		});
	}

};

/**
 * Handles card name change event for a specific card
 *
 * @param jQuery $title
 * @param Boolean refreshData
 */
TrelloBoost.cardNameChange = function ($title,refreshData) {
	let html = jQuery.trim($title.html());
	if (jQuery.trim($title.text()).length < 5) return;
	if (html.indexOf('<span class="tpro"></span>') > -1) return;

	//console.log('!?');

	// reference the card (parent)
	let $card = $title.parents('.list-card');

	// wrap HTML and remove card number
	let $htmlWrapper = jQuery('<div></div>').html(html);
	let $projectNumber = $htmlWrapper.find('.card-short-id');
	// if($projectNumber.length == 0) {
	//	 //var cardNumber = $title.attr('href').split('/')[3].split('-')[0];
	//	 // let cardNumber = 't';
	//	 // $projectNumber = jQuery('<span class="card-short-id hide">#'+cardNumber+'</span>');
	// }
	// else {
	//	 $projectNumber.detach();
	// }
	$projectNumber.detach();
	html = $htmlWrapper.html();

	// delay
	setTimeout(function () {
		let filterAttributes = [];

		// groups/projects
		if (TrelloBoost.settings['parse-projects']) {
			for(let i in TrelloBoost.config.regex.tags) {
				html = html.replace(TrelloBoost.config.regex.tags[i], function (match, capture) {
					let project = TrelloBoost.config.renderers.tags(capture);
					filterAttributes.push('tpro-project-' + TrelloBoost.renderAttrName(project));
					return '<span class="tpro-project">' + project + '</span>';
				});
			}
		}

		// labels/tags
		if (TrelloBoost.settings['parse-labels']) {
			html = html.replace(TrelloBoost.config.regex.labels, function (match, capture) {
				let label = TrelloBoost.config.renderers.labels(capture);
				filterAttributes.push('tpro-label-' + TrelloBoost.renderAttrName(label));
				return '<div class="badge tpro-tag tpro-label">' + TrelloBoost.config.symbols.label + ' ' + label + '</div>';
			});
		}

		// time entries
		if (TrelloBoost.settings['parse-time-entries']) {
			html = html.replace(TrelloBoost.config.regex.time_entries, function (match, capture) {
				return '<div class="badge tpro-tag tpro-time-entry">' + TrelloBoost.config.symbols.time_entry + ' ' + TrelloBoost.config.renderers.time_entries(capture) + '</div>';
			});
		}

		// points
		if (TrelloBoost.settings['parse-points']) {
			html = html.replace(TrelloBoost.config.regex.points, function (match, capture) {
				return '<div class="badge tpro-tag tpro-point">' + TrelloBoost.config.symbols.point + ' ' + TrelloBoost.config.renderers.points(capture) + '</div>';
			});
		}

		// priority marks
		if (TrelloBoost.settings['parse-priority-marks']) {
			let priorityCount = (html.match(/\!/g) || []).length;
			if(priorityCount > 0) {
				let priority = 'critical';
				switch(priorityCount) {
					case 1: priority = 'medium'; break;
					case 2: priority = 'high'; break;
				}
				filterAttributes.push('tpro-priority-'+priority);
				html = html.replace(/\!/g,'') + '<span class="badge tpro-tag tpro-priority"><i class="fa fa-exclamation-triangle tpro-priority ' + priority + '" aria-hidden="true"></i></span>';
			}
			else {
				// normal priority
				filterAttributes.push('tpro-priority-normal');
			}
		}

		// wrap HTML
		$htmlWrapper = jQuery('<div></div>').html(html);

		// add control span and re-introduce project number
		$htmlWrapper.prepend($projectNumber);
		$htmlWrapper.prepend('<span class="tpro"></span>');

		// get tags
		let tags = [];
		$htmlWrapper.find('.tpro-tag').each(function () {
			tags.push(jQuery(this));
		});

		// handle tags
		$card.find('.tpro-tag').remove();
		for (let i in tags) {
			if(tags[i].hasClass('tpro-priority')) {
				$card.find('.badges').prepend(tags[i]);
				continue;
			}
			$card.find('.badges').append(tags[i]);
		}

		// handle priority
		let $priority = $htmlWrapper.find('.tpro-priority');
		if($priority.length != 0) $priority.detach().appendTo($htmlWrapper);

		// apply filterAttributes
		$card.removeClass (function (index, css) {
			return (css.match (/(^|\s)tpro-\S+/g) || []).join(' ');
		});
		for(let i in filterAttributes) $card.addClass(filterAttributes[i]);

		// handle title & refresh data
		$title.html($htmlWrapper.html());
		if(refreshData) TrelloBoost.refreshData();
	});
}

/**
 * Loads current settings in the settings pane
 */
TrelloBoost.loadSettingsPane = function () {
	// check for board override
	if(TrelloBoost.settingsOverride) {
		TrelloBoost.$settingsPane.find('input[name="board-override"]')
			.attr('checked','checked')
			.parents('.switch').css('background','#2ecc71');
		TrelloBoost.$settingsPane.find('.tpro-settings-container').show();
	} else {
		TrelloBoost.$settingsPane.find('input[name="board-override"]')
			.removeAttr('checked')
			.parents('.switch').css('background','#BDB9A6');
		TrelloBoost.$settingsPane.find('.tpro-settings-container').hide();
	}

	// load settings
	for (let key in TrelloBoost.settings) {
		// try checkbox
		let checkbox = TrelloBoost.$settingsPane.find('input[type="checkbox"][name="' + key + '"]');
		if (checkbox.length != 0) {
			if (TrelloBoost.settings[key]) {
				checkbox.attr('checked', true);
				checkbox.parents('.checklist-item').addClass('checklist-item-state-complete');
			}
			else {
				checkbox.removeAttr('checked');
				checkbox.parents('.checklist-item').removeClass('checklist-item-state-complete');
			}
			continue;
		}

		// try textarea
		let textarea = TrelloBoost.$settingsPane.find('textarea[name="' + key + '"]');
		if (textarea.length != 0) {
			textarea.val(TrelloBoost.settings[key]);
			continue;
		}

		// try radio
		let radio = TrelloBoost.$settingsPane.find('input[type="radio"][name="' + key + '"][value="' + TrelloBoost.settings[key] + '"]');
		if(radio.length != 0) {
			radio.attr('checked',true);
			continue;
		}
	}
}

/**
 * Builds the settings pane
 */
TrelloBoost.buildSettingsPane = function () {
		// load settings HTML
		TrelloBoost.$settingsPane = jQuery('<div class="tpro-settings-wrapper" style="display:none"></div>');
		TrelloBoost.$settingsPane.load(chrome.extension.getURL("tmpl/settings.html"), function () {
				// determine root paths
				let imgRoot = chrome.extension.getURL('img');
				let docsRoot = chrome.extension.getURL('docs');

				// handle image sources
				TrelloBoost.$settingsPane.find('img').each(function(){
					let $img = jQuery(this);
					$img.attr('src',$img.attr('src').replace('{$PATH}',imgRoot));
				});

				// handle docs source
				TrelloBoost.$settingsPane.find('a').each(function(){
					let $a = jQuery(this);
					$a.attr('href',$a.attr('href').replace('{$PATH}',docsRoot));
				});

				// attach toggle behaviour
				TrelloBoost.$settingsPane.find('input[name="board-override"]').on('change',function(){
					let $this = jQuery(this);
					if($this.is(':checked')) {
						$this.parents('.switch').css('background','#2ecc71');
						TrelloBoost.$settingsPane.find('.tpro-settings-container').slideDown();
					} else {
						$this.parents('.switch').css('background','#BDB9A6');
						TrelloBoost.$settingsPane.find('.tpro-settings-container').slideUp();
					}
				});

				// attach close button behaviour
				TrelloBoost.$settingsPane.find('.tpro-settings-close').on('click', function () {
					TrelloBoost.$settingsPane.fadeOut(150);
					jQuery('#board').show();
				});

				// attach save button behaviour
				TrelloBoost.$settingsPane.find('.tpro-settings-save').on('click', function () {
					// check for override
					if(!TrelloBoost.$settingsPane.find('input[name="board-override"]').is(':checked')) {
						TrelloBoost.settings = false;
					} else {
						// handle checkboxes
						TrelloBoost.$settingsPane.find('input[type="checkbox"]').each(function () {
							let checkbox = jQuery(this);
							TrelloBoost.settings[checkbox.attr('name')] = checkbox.prop('checked');
						});

						// handle text area inputs
						TrelloBoost.$settingsPane.find('textarea').each(function () {
							let textarea = jQuery(this);
							TrelloBoost.settings[textarea.attr('name')] = textarea.val();
						});

						// handle select/radio buttons
						TrelloBoost.$settingsPane.find('.tpro-settings-radio-group').each(function () {
							let radio = jQuery(this).find('input').filter(':checked');
							TrelloBoost.settings[radio.attr('name')] = radio.val();
						});
					}

					// update settings
					let settings = {};
					settings[TrelloBoost.boardId] = TrelloBoost.settings;
					chrome.storage.sync.set(settings, function () {
						window.location.reload();
					});
				});

				// attach checkbox item behavior
				TrelloBoost.$settingsPane.find('.checklist-item-checkbox').on('click', function () {
					let item = jQuery(this).parents('.checklist-item');
					item.toggleClass('checklist-item-state-complete');
					if (item.hasClass('checklist-item-state-complete')) item.find('input[type="checkbox"]').attr('checked', 'checked');
					else item.find('input[type="checkbox"]').removeAttr('checked');
				});

				TrelloBoost.$settingsPane.appendTo(jQuery('.board-canvas'));
			});
}

/**
 * Builds the TrelloBoost menu
 */
TrelloBoost.buildMenu = function () {
	let $button = jQuery('<a id="tpro-filter-trigger" class="board-header-btn calendar-btn" href="#"><span class="icon-sm icon-board board-header-btn-icon"></span><span class="board-header-btn-text u-text-underline">TrelloBoost</span></a>');
	$button.on('click', function () {
		if (TrelloBoost.$settingsPane.is(':visible')) {
			TrelloBoost.$settingsPane.fadeOut(150);
			jQuery('#board').show();
		}
		else {
			TrelloBoost.loadSettingsPane();
			jQuery('#board').hide();
			TrelloBoost.$settingsPane.fadeIn(150);
		}
	});
	setTimeout(function(){
		$button.prependTo(jQuery('.board-header-btns.mod-right'));
	},500);
}

/**
 * Builds the Project Filter
 */
TrelloBoost.buildProjectFilter = function () {
	// create menu item
	let $menuItem = jQuery('<a id="tpro-header-button-filter" class="board-header-btn" href="#"></a>');

	// try to apply pre-loaded filter
	let $filter = jQuery('<span id="tpro-filter" data-project="" class="board-header-btn-text u-text-underline">All</span>');
	if(TrelloBoost.settings.filters.project) {
		for(let i=0; i<TrelloBoost.projects.length; i++) {
			if(TrelloBoost.settings.filters.project == TrelloBoost.projects[i].key) {
				$filter.attr('data-project',TrelloBoost.settings.filters.project);
				$filter.text(TrelloBoost.projects[i].value + '('+TrelloBoost.projects[i].cardCount+')');
				break;
			}
		}
	}
	$menuItem.append('<span class="board-header-btn-icon icon-sm icon-filter"></span>');
	$menuItem.append(jQuery('<span class="board-header-btn-text"><span>Show: </span></span>').append($filter));

	// add behaviour
	$menuItem.on('click',function(e){
		let $popup = jQuery('#tpro-filter-popup');
		let $this = jQuery(this);
		if($popup.is(':visible')) { $popup.hide(); }
		else {
			// render project data
			let $list = $popup.find('ul.pop-over-list').html("");
			let selected = jQuery('#tpro-filter').attr('data-project');
			for(project of TrelloBoost.projects) {
				let $a = jQuery(
					'<a class="js-select light-hover" data-project="'+project.key+'" href="#">'
						+project.value+' <span>('+project.cardCount+')</span>'
					+'</a>'
				);
				if(project.key == selected) $a.addClass('disabled');
				$list.append(jQuery('<li></li>').append($a));
			}
			$list.prepend('<li><a class="js-select light-hover" data-project="" href="#">All</a></li>'); // default "all"

			// attach filter behaviour
			$list.find('li a').on('click',function(evt){
				let $this = jQuery(this);

				// update filter in menu
				$filter.attr('data-project',$this.data().project);
				$filter.text($this.text());

				// update filters
				let project = $this.data().project;

				TrelloBoost.settings.filters.project = (project != "") ? project : false;
				TrelloBoost.rebuildDynamicStyles();
				TrelloBoost.saveSettings();
				setTimeout(TrelloBoost.refreshData,54);

				$popup.hide();

				evt.preventDefault();
				return false;
			});

			// show popup
			$popup.css({
				top: $this.position().top + $this.offset().top + $this.outerHeight(true) + 6,
				left: $this.offset().left
			}).show();
		}

		e.preventDefault();
		return false;
	});

	// create filter popup
	$filterPopup = jQuery('<div id="tpro-filter-popup"></div>');
	$filterPopup.append(
		'<div class="pop-over-header js-pop-over-header">'
			+'<span class="pop-over-header-title">Filter Cards</span>'
			+'<a href="#" class="pop-over-header-close-btn icon-sm icon-close"></a>'
		+'</div>'
	);
	$filterPopup.append(
		'<div><div class="pop-over-content js-pop-over-content u-fancy-scrollbar js-tab-parent" style="max-height: 673px;">'
			+'<div>'
				+'<ul class="pop-over-list">'
					+'<li><a class="js-select light-hover" href="#">All</a></li>'
				+'</ul>'
			+'</div>'
		+'</div></div>'
	);
	$filterPopup.find('a.pop-over-header-close-btn').on('click',function(e){
		$filterPopup.hide();
		e.preventDefault();
		return false;
	});

	jQuery('.board-header-btns.mod-left').append($menuItem);
	jQuery('body').append($filterPopup);
}

/**
 * Builds the Labels Filter
 */
TrelloBoost.buildLabelsFilter = function () {
	let $menuItem = jQuery('<a class="board-header-btn" href="#"></a>');
	$menuItem.append('<span class="board-header-btn-icon icon-sm icon-label"></span>');
	$menuItem.append('<span class="board-header-btn-text">Tags: <span style="text-decoration: underline">All</span></span>');

	// TODO: implement

	jQuery('.board-header-btns.mod-left').append($menuItem);
}

/**
 * Builds stats for a list
 *
 * @param {jQuery} $list
 * @param {Object} list
 */
TrelloBoost.buildListStats = function($list,list) {
	// init and clear stats
	let $stats = $list.parent().find('.tpro-list-stats');
	if($stats.length == 0) {
		$stats = jQuery('<div class="tpro-list-stats"></div>');

		// card count
		$stats.prepend(
			'<span class="tpro-stat count" title="Total cards">'
				+'<i class="fa fa-hashtag" aria-hidden="true"></i> '
				+'<span></span>'
			+'</span>'
		);

		// tasks count
		$stats.prepend(
			'<span class="tpro-stat checklist" title="Checklist Tasks">'
				+'<i class="fa fa-check-square-o" aria-hidden="true"></i> '
				+'<span></span>'
			+'</span>');

		// points
		if(TrelloBoost.settings['parse-points']) {
			$stats.prepend(
				'<span class="tpro-stat points" title="Total Points">'
					+'<i class="fa fa-star" aria-hidden="true"></i> '
					+'<span></span>'
				+'</span>');
		}

		// progress bar
		if(TrelloBoost.settings['show-list-stats-progressbar']) {
			$stats.append(
				'<div class="progress-bar-wrapper">'
					+'<div class="checklist-progress">'
						+'<span class="checklist-progress-percentage">0%</span>'
						+'<div class="checklist-progress-bar">'
							+'<div class="checklist-progress-bar-current" style="width: 0%;"></div>'
						+'</div>'
					+'</div>'
				+'</div>');
				$stats.css('height','35px');
		} else {
			$stats.css('height','25px');
		}

		$stats.insertBefore($list);
	}

	// card count
	$stats.find('.tpro-stat.count span').text(list.totalVisibleCards == list.totalCards
		? list.totalCards
		: list.totalVisibleCards + '/' + list.totalCards
	);

	// tasks count
	$stats.find('.tpro-stat.checklist span').text(list.completedTasks + '/' + list.totalTasks);

	// points
	if(TrelloBoost.settings['parse-points']) {
		$stats.find('.tpro-stat.points span').text(list.totalVisiblePoints == list.totalPoints
			? list.totalPoints
			: list.totalVisiblePoints + '/' + list.totalPoints
		);
	}

	// progress bar
	if(TrelloBoost.settings['show-list-stats-progressbar']) {
		let percentage = (list.totalTasks == 0) ? 100 : Math.floor((list.completedTasks*100)/list.totalTasks);
		$stats.find('.checklist-progress-bar-current').css('width',percentage+'%');
		$stats.find('.checklist-progress-percentage').text(percentage+'%');
	}
}

/**
 * Refreshes data for the current board
 */
TrelloBoost.refreshData = function() {
	if(!TrelloBoost.loaded) return;

	// just a sorting function
	let sorter = function(a,b) { return a.key.localeCompare(b.key); }

	// get all lists
	let lists = [];
	let $lists = jQuery('.list');
	for(let i=0; i<$lists.length; i++) {
		let $this = jQuery($lists[i]);
		let list = {};

		/**
		 * Filters visible cards only
		 */
		let visibleFilter = function() {
			// ignore filtered by project
			if(TrelloBoost.settings.filters.project
				&& !jQuery(this).hasClass('tpro-project-' + TrelloBoost.settings.filters.project)) return false;

			// ignore filtered by Trello
			return jQuery(this).height() > 20;
		};

		// set basics
		list.title = $this.find('textarea.list-header-name').val();
		list.totalCards = parseInt($this.find('.list-header-num-cards').text());
		list.totalVisibleCards = $this.find('.list-card').filter(visibleFilter).length;

		// count points
		list.totalPoints = 0;
		list.totalVisiblePoints = 0;
		$this.find('.tpro-point').each(function(){
			list.totalPoints += parseInt(jQuery.trim(jQuery(this).text()).match(/\d+/)[0]);
		});
		$this.find('.list-card').filter(visibleFilter).find('.tpro-point').each(function(){
			list.totalVisiblePoints += parseInt(jQuery.trim(jQuery(this).text()).match(/\d+/)[0]);
		});

		// count checklist tasks
		list.totalTasks = 0;
		list.completedTasks = 0;
		$this.find('.js-badges .icon-checklist').each(function(){
			let stats = jQuery(this).next('.badge-text').text().split('/');
			list.completedTasks += parseInt(stats[0]);
			list.totalTasks += parseInt(stats[1]);
		});

		// refresh stats
		if(TrelloBoost.settings['show-list-stats']) TrelloBoost.buildListStats($this,list);
		lists.push(list);
	}

	// get all projects
	var projects = [];
	var keys = [];
	let $projects = jQuery('.tpro-project');
	for(let i=0; i<$projects.length; i++) {
		var project = jQuery.trim(jQuery($projects[i]).text());
		var key = TrelloBoost.renderAttrName(project);
		var index = jQuery.inArray(key,keys);
		if(index > -1) {
			projects[index].cardCount++;
		}
		else {
			projects.push({ key: key, value: project, cardCount: 1 });
			keys.push(key);
		}
	}
	projects.sort(sorter);

	// get all labels
	var labels = [];
	keys = [];
	let $labels = jQuery('.tpro-tag.tpro-label');
	for(let i=0; i<$labels.length; i++) {
		let label = jQuery.trim(jQuery($labels[i]).text().replace(TrelloBoost.config.symbols.label,""));
		let key = TrelloBoost.renderAttrName(label);
		let index = jQuery.inArray(key,keys);
		if(index > -1) {
			labels[index].cardCount++;
		}
		else {
			labels.push({ key: key, value: label, cardCount: 1 });
			keys.push(key);
		}
	}
	labels.sort(sorter);

	TrelloBoost.lists = lists;
	TrelloBoost.projects = projects;
	TrelloBoost.labels = labels;
}

/**
 * Prepares a given string name to be used as a HTML attribute
 *
 * @param string name
 * @return string
 */
TrelloBoost.renderAttrName = function(name) {
	return name.toLowerCase()
		.replace('&amp;','and').replace('&','and')
		.replace(/\(.+?\)/g, '').replace(/[^a-z0-9+]+/gi, '-');
}

/**
 * Injects or removes a CSS stylesheet based on settings
 *
 * @param string name
 */
TrelloBoost.toggleCssInject = function(name) {
	if (TrelloBoost.settings[name]) {
		let $inject = jQuery('<style id="tpro-'+name+'-css"></style>');
		$inject.load(chrome.extension.getURL('css/'+name+'.css'), function () {
			jQuery('body').append($inject);
		});
	} else jQuery('#tpro-'+name+'-css').remove();
}

/**
 * Rebuilds dynamic styles based on input
 */
TrelloBoost.rebuildDynamicStyles = function() {
	let css = '';

	// build filters
	let filtered = false;
	if(TrelloBoost.settings.filters.project) {
		// apply only if project exists
		for(let i=0; i<TrelloBoost.projects.length; i++) {
			if(TrelloBoost.settings.filters.project == TrelloBoost.projects[i].key) {
				css += '#tpro-header-button-filter { background-color: #2c3e50; } ';
				css += '.list-card.tpro-project-' + TrelloBoost.settings.filters.project + ':not(.hide) { display: block; } ';
				filtered = true;
				break;
			}
		}
	}
	if(filtered) css += '.list-card { display:none } ';

	TrelloBoost.$dynamicStyles.html(css);
}

/**
 * Attempts to save current board settings
 */
TrelloBoost.saveSettings = function() {
	let settings = {};
	settings[TrelloBoost.boardId] = TrelloBoost.settings;
	chrome.storage.sync.set(settings);
}

/**
 * Loads everything
 */
TrelloBoost.load = function () {
	// load for boards only
	if(window.location.href.split('/')[3] != 'b') return;

	// get board ID and title
	let boardId = window.location.href.split('/')[4];
	let boardTitle = jQuery.trim(jQuery('title').text());

	// prevent double loading
	if(TrelloBoost.boardId == boardId) return;

	// re-init for current board
	TrelloBoost.boardId = boardId;
	TrelloBoost.boardTitle = boardTitle;
	TrelloBoost.loaded = false;

	//console.log('TrelloBoost: Loading board ' + boardId + '.');

	// load settings
	TrelloBoost.settings = TrelloBoost.config.defaultSettings;
	chrome.storage.sync.get(['defaults',TrelloBoost.boardId], function (settings) {
		// set board-specific settings flag
		TrelloBoost.settingsOverride = settings[TrelloBoost.boardId] ? true : false;

		// get defaults and board-specific settings
		let defaults = settings['defaults'] ? settings['defaults'] : {};
		let boardSettings = settings[TrelloBoost.boardId] ? settings[TrelloBoost.boardId] : {};

		// merge settings
		TrelloBoost.settings = jQuery.extend({}, TrelloBoost.settings, defaults);
		TrelloBoost.settings = jQuery.extend({}, TrelloBoost.settings, boardSettings);

		// label sizes
		if(TrelloBoost.settings['visible-labels']) {
			jQuery('body').addClass('tpro-card-labels-size-'+TrelloBoost.settings['labels-size']);
		} else {
			jQuery('body').removeClass('tpro-card-labels-size-'+TrelloBoost.settings['labels-size']);
		}

		// list stats
		if(TrelloBoost.settings['show-list-stats']) jQuery('body').addClass('tpro-show-list-stats');
		else jQuery('body').removeClass('tpro-show-list-stats');

		// custom background
		if (TrelloBoost.settings['custom-background'] && TrelloBoost.settings['custom-background-input'] != "") {
			let $customBackgroundStyle = jQuery('<style id="tpro-custom-background-css">body { background-image: url("'+TrelloBoost.settings['custom-background-input']+'") !important }</style>');
			jQuery('body').append($customBackgroundStyle);
		}
		else {
			let $customBackgroundStyle = jQuery("#tpro-custom-background-css");
			while(true) {
				$customBackgroundStyle.remove();
				$customBackgroundStyle = jQuery("#tpro-custom-background-css");
				if($customBackgroundStyle.length == 0) break;
			}
		}

		// custom CSS
		if (TrelloBoost.settings['custom-css'] && TrelloBoost.settings['custom-css-input'] != "") {
			jQuery('body').append('<style id="tpro-custom-css">' + TrelloBoost.settings['custom-css-input'] + '</style>');
		}
		else jQuery("#tpro-custom-css").remove();

		TrelloBoost.toggleCssInject('visible-card-numbers');
		TrelloBoost.toggleCssInject('visible-labels');
		TrelloBoost.toggleCssInject('hide-activity-entries');
		//TrelloBoost.toggleCssInject('full-screen-cards');
		TrelloBoost.toggleCssInject('hide-add-list');
		TrelloBoost.toggleCssInject('beautify-markdown');
		TrelloBoost.toggleCssInject('compact-cards');

		TrelloBoost.loaded = true;

		// parsing on?
		let parsing_on = TrelloBoost.settings['parse-projects']
			|| TrelloBoost.settings['parse-labels']
			|| TrelloBoost.settings['parse-time-entries']
			|| TrelloBoost.settings['parse-priority-marks']
			|| TrelloBoost.settings['parse-points'];
		if (parsing_on) {
			// run card name processing on all initial cards
			let $initCards = jQuery('.list-card-title');
			for(let i=0; i<$initCards.length; i++) {
				TrelloBoost.cardNameChange(jQuery($initCards[i]),false);
			}
		}

		setTimeout(function(){
			TrelloBoost.refreshData();
			TrelloBoost.buildSettingsPane();
			TrelloBoost.buildMenu();
			if(TrelloBoost.settings['parse-projects']) TrelloBoost.buildProjectFilter();
			//TrelloBoost.buildLabelsFilter();
			TrelloBoost.rebuildDynamicStyles();
		},1000);
	});
}

/**
 * Initializes the content script
 */
let tpro = function(){

	// introduce dynamic styles
	TrelloBoost.$dynamicStyles = jQuery('<style id="tpro-dynamic-css"></style>').appendTo(jQuery('body'));

	// introduce font awesome
	if(jQuery('#trello-pro-font-awesome').length == 0) {
		jQuery('body').append('<link id="trello-pro-font-awesome" href="'+chrome.extension.getURL("lib/font-awesome/css/font-awesome.min.css")+'" rel="stylesheet">');
	}

	// bind ESC key
	jQuery(document).bind('keyup', function(e) {
		if(!TrelloBoost.loaded) return;

		if(e.keyCode === 27) {

			// filter popup
			let $popup = jQuery('#tpro-filter-popup');
			if($popup.is(':visible')) {
				$popup.hide();
				return;
			}

			// settings
			let $settings = jQuery('.tpro-settings-wrapper');
			if($settings.is(':visible')) {
				$settings.find('.tpro-settings-close').click();
				return;
			}

		}
	});

	// bind mouse click
	jQuery(document).bind('mouseup', function (e){
		if(!TrelloBoost.loaded) return;

		// filter popup
		let $popup = jQuery('#tpro-filter-popup');
		if (!$popup.is(e.target) && $popup.has(e.target).length === 0) {
				$popup.hide();
				return;
		}
	});

	// catch board changes
	jQuery('title').bind("DOMSubtreeModified",function(){
		let title = jQuery.trim(jQuery(this).text());
		let path = window.location.href.split('/');

		if(path[3] != 'b') return; // works for boards only, not cards

		// check if board was changed
		if(title == TrelloBoost.boardTitle || TrelloBoost.boardId == path[4]) {
			TrelloBoost.loaded = true; // unlock everything
			return;
		}

		TrelloBoost.load();
	});

	// bind card name processing to card title changes
	jQuery(document).on('DOMSubtreeModified', '.list-card-title', function (e) {
		//if(!TrelloBoost.loaded) return;
		let $card = jQuery(this).parents('.list-card');
		if ($card.hasClass('placeholder')) return;
		if ($card.css('position') == 'absolute') return;
		TrelloBoost.cardNameChange($card.find('.list-card-title'),true);
	});

	// bind card name processing to card list changes
	jQuery(document).bind('DOMNodeInserted', function(e) {
		if(!TrelloBoost.loaded) return;
		let $card = jQuery(e.target);
		if(!$card.hasClass('list-card')) return;
		if ($card.hasClass('placeholder')) return;
		if ($card.css('position') == 'absolute') return;
		TrelloBoost.cardNameChange($card.find('.list-card-title'),true);
	});

	// inject special event tracker
	let $changeTrigger = jQuery('<input type="hidden" id="trpo-history-state-change-trigger" value="" />');
	jQuery('body')
		.append($changeTrigger)
		.append(
			'<script type="text/javascript"> '
				+'var tproEvent = document.getElementById("trpo-history-state-change-trigger"); '
				+'let replaceStateOrigin = history.replaceState; '
				+'history.replaceState = function(state){ '
					+'tproEvent.value = "history.replaceState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'replaceStateOrigin.apply(history, arguments); '
				+'}; '
				+'let pushStateOrigin = history.pushState; '
				+'history.pushState = function(state){ '
					+'tproEvent.value = "history.pushState"; '
					+'let e = document.createEvent("HTMLEvents"); e.initEvent("change", false, true); tproEvent.dispatchEvent(e); '
					+'pushStateOrigin.apply(history, arguments); '
				+'}'
			+'</script>'
		);

	// handle events
	$changeTrigger.on('change',function(){
		if(!TrelloBoost.loaded) return;
		let evt = jQuery(this).val();
		switch (evt) {
			case 'history.replaceState':
				// refresh data after Trello filter replaces state
				setTimeout(TrelloBoost.refreshData,54);
				return;
			case 'history.pushState':
				// lock everything
				TrelloBoost.loaded = false;
				return;
		}
	});

	// start loading the extension
	TrelloBoost.load();

	// trigger data refresh every 7.5 seconds
	(refresh = function() { TrelloBoost.refreshData(); setTimeout(refresh,7500); })();

	// // check if a card is opened directly
	// if(window.location.href.split('/')[3] == 'c') {
	//	 chrome.storage.local.set({ 'tpro-redirect': window.location.href });
	//	 setTimeout(function(){
	//		 console.log(jQuery('.window-wrapper a.icon-close').get(0))
	//		 jQuery('.window-wrapper a.icon-close').click();
	//	 },2000) ;
	// }
	// else if(window.location.href.split('/')[3] == 'b') {
	//	 // check for redirect
	//	 chrome.storage.local.get('tpro-redirect',function(result){
	//		 if(result['tpro-redirect'] && result['tpro-redirect'] != null) {
	//			 chrome.storage.local.set({ 'tpro-redirect': null, 'tpro-board-id': window.location.href.split('/')[4] });
	//			 history.pushState(null, null, result['tpro-redirect']);
	//		 }
	//		 else TrelloBoost.load();
	//	 });
	// }
};

tpro();
