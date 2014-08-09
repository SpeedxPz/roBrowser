/**
 * UI/Components/PartyFriends/PartyFriends.js
 *
 * Manage interface for parties and friends
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB             = require('DB/DBManager');
	var Preferences    = require('Core/Preferences');
	var Client         = require('Core/Client');
	var Renderer       = require('Renderer/Renderer');
	var Session        = require('Engine/SessionStorage');
	var UIManager      = require('UI/UIManager');
	var UIComponent    = require('UI/UIComponent');
	var ContextMenu    = require('UI/Components/ContextMenu/ContextMenu');
	var ChatBox        = require('UI/Components/ChatBox/ChatBox');
	var htmlText       = require('text!./PartyFriends.html');
	var cssText        = require('text!./PartyFriends.css');


	/**
	 * Create Component
	 */
	var PartyFriends = new UIComponent('PartyFriends', htmlText, cssText );


	/**
	 * @var {number} index of selection
	 */
	var _index = -1;


	/**
	 * @var {Array} friends list
	 */
	var _friends = [];


	/**
	 * @var {Array} party list
	 */
	var _party = [];


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('PartyFriends', {
		x:        200,
		y:        200,
	//	width:    7,
	//	height:   4,
		show:     false,
		friend:   true,
		lock:     false
	}, 1.0);


	/**
	 * Initialize the component (event listener, etc.)
	 */
	PartyFriends.init = function init()
	{
		// Avoid drag drop problems
		this.ui.find('.base').mousedown(function(event){
			event.stopImmediatePropagation();
			return false;
		});

		// Bind buttons
		this.ui.find('.close').click(onClose);
		this.ui.find('.lock').mousedown(onToggleLock);
		this.ui.find('.switchtab.off').mousedown(onChangeTab);
		this.ui.find('.remove').mousedown(onRequestRemoveSelection);
		this.ui.find('.privatemessage').mousedown(onRequestPrivateMessage);
		this.ui.find('.leave').mousedown(onRequestLeaveParty);

		//this.ui.find('.mail').mousedown();
		//this.ui.find('.info').mousedown();
		//this.ui.find('.party.create').mousedown();
		//this.ui.find('.party.add').mousedown();

		this.ui.find('.content')
			.on('contextmenu', '.name', onRightClickInfo)
			.on('mousedown',   '.name', onSelectionChange)

		this.draggable(this.ui.find('.titlebar'));
	};


	/**
	 * Once append to the DOM, start to position the UI
	 */
	PartyFriends.onAppend = function onAppend()
	{
		// Initialize the tab
		_preferences.friend = !_preferences.friend;
		onChangeTab();

		// Lock features
		if (_preferences.lock) {
			this.ui.find('.lock.on').show();
			this.ui.find('.lock.off').hide();
		}
		else {
			this.ui.find('.lock.on').hide();
			this.ui.find('.lock.off').show();
		}

		// TODO:
		//this.resize( _preferences.width, _preferences.height );

		this.ui.css({
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.height()),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.width())
		});

		if (!_preferences.show) {
			this.ui.hide();
		}
	};


	/**
	 * Removing the UI from window, save preferences
	 *
	 */
	PartyFriends.onRemove = function onRemove()
	{
		// TODO: does the packet is sent at each map-change ?
		//this.ui.find('.container .content').empty();

		// Save preferences
		_preferences.show   =  this.ui.is(':visible');
		_preferences.y      =  parseInt(this.ui.css('top'), 10);
		_preferences.x      =  parseInt(this.ui.css('left'), 10);
		//_preferences.width  =  Math.floor( (this.ui.width()  - (23 + 16 + 16 - 30)) / 32 );
		//_preferences.height =  Math.floor( (this.ui.height() - (31 + 19 - 30     )) / 32 );
		_preferences.save();
	};


	/**
	 * Window Shortcuts
	 */
	PartyFriends.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'FRIEND':
				if (_preferences.friend) {
					this.ui.toggle();
				}
				else {
					_preferences.friend = false;
					onChangeTab();
					this.ui.show();
				}

				if (this.ui.is(':visible')) {
					this.focus();
				}
				break;

			case 'PARTY':
				if (!_preferences.friend) {
					this.ui.toggle();
				}
				else {
					_preferences.friend = true;
					onChangeTab();
					this.ui.show();
				}

				if (this.ui.is(':visible')) {
					this.focus();
				}
				break;
		}
	};


	/**
	 * Set friends to UI
	 *
	 * @param {Array} friends list
	 */
	PartyFriends.setFriends = function setFriends( friends )
	{
		var i, count = friends.length;
		var ui = this.ui.find('.content .friend');

		_friends.length = friends.length;
		ui.empty();

		for (i = 0; i < count; i++) {
			_friends[i] = friends[i];
			ui.append(
				'<div class="node'+ (friends[i].state === 0 ? ' online' : '') +'">' +
					'<span class="name">' + friends[i].Name + '</span>' +
				'</div>'
			);
		}

		this.ui.find('.friendcount').text(count);
		_index = -1;
	};


	/**
	 * Update friend (online/offline) state
	 *
	 * @param {number} index
	 * @param {boolean} state
	 */
	PartyFriends.updateFriendState = function updateFriendState( index, state)
	{
		var node = this.ui.find('.content .friend .node:eq(' + index + ')');

		if (state) {
			node.css('backgroundImage', '');
			ChatBox.addText( DB.getMessage(1042).replace('%s', _friends[index].Name), ChatBox.TYPE.BLUE);
			return;
		}

		ChatBox.addText( DB.getMessage(1041).replace('%s', _friends[index].Name), ChatBox.TYPE.BLUE);
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_online.bmp', function(url){
			node.css('backgroundImage', 'url(' + url + ')');
		});
	};


	/**
	 * Update/Add a friend to the list
	 *
	 * @param {number} index
	 * @param {object} friend data
	 */
	PartyFriends.updateFriend = function updateFriend(idx, friend)
	{
		// Add it
		if (!_friends[idx]) {
			_friends[idx] = {};

			this.ui.find('.content .friend').append(
				'<div class="node">' +
					'<span class="name"></span>' +
				'</div>'
			);

			this.ui.find('.friendcount').text(_friends.length);
		}

		_friends[idx].Name = friend.Name;
		_friends[idx].GID  = friend.GID;
		_friends[idx].AID  = friend.AID;

		var node = this.ui.find('.content .friend .node:eq('+ idx +')');
		node.find('.name').text(friend.Name);

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_online.bmp', function(url){
			node.css('backgroundImage', 'url(' + url + ')');
		});
	};


	/**
	 * Remove friend from list
	 *
	 * @param {number} index
	 */
	PartyFriends.removeFriend = function removeFriend(index)
	{
		_friends.splice(index, 1);
		this.ui.find('.content .friend .node:eq('+ index +')').remove();
		this.ui.find('.friendcount').text(_friends.length);

		if (_index === index) {
			_index = -1;
		}
	};


	/**
	 * Add members to party
	 *
	 * @param {string} party name
	 * @param {Array} member list
	 */
	PartyFriends.setParty = function setParty(name, members)
	{
		this.ui.find('.partyname').text('('+name+')');
		this.ui.find('.content .party').empty();
		Session.isPartyLeader = false;

		this.ui.find('.party.create').hide();
		this.ui.find('.party.leave').show();

		var i, count = members.length;

		_party.length = 0;
		for (i = 0; i < count; i++) {
			PartyFriends.addPartyMember(members[i]);
		}

		_index = -1;
	};


	/**
	 * Add a new party member to the list
	 *
	 * @param {object} player information
	 */
	PartyFriends.addPartyMember = function addPartyMember( player )
	{
		var role = player.role || player.Role || 0;
		var i, count = _party.length;
		var node, texture;

		// Check if we are the leader
		if (player.AID === Session.AID) {
			Session.isPartyLeader = (role === 0);
			if (Session.isPartyLeader) {
				this.ui.find('.party.add').show();
			}
			else {
				this.ui.find('.party.add').hide();
			}
		}

		// Search for duplicates entries
		for (i = 0; i < count; ++i) {
			if (_party[i].AID === player.AID) {
				break;
			}
		}

		// Update
		if (i < count) {
			node = this.ui.find('.content .party .node:eq('+ i +')');
			node.removeClass('leader online');

			if (role === 0) {
				node.addClass('leader');
			}
			if (player.state === 0) {
				node.addClass('online');
			}

			node.css('backgroundImage', '');
			node.find('.name').text(player.characterName);
			node.find('.map').text(DB.getMapName(player.mapName));
		}

		// Create
		else {
			_party.push(player);
			this.ui.find('.content .party').append(
				'<div class="node'+ (role === 0 ? ' leader' : '') + (player.state === 0 ? ' online' : '') + (player.AID === Session.AID ? ' self' : '') + '">' +
					'<span class="name">' + player.characterName + '</span>' +
					'<span class="map">(' + DB.getMapName(player.mapName) + ')</span>' +
					'<canvas class="life" width="60" height="5"></canvas> <span class="hp"></span>' +
				'</div>'
			);

			node = this.ui.find('.content .party .node:eq('+ i +')');
		}

		// Add texture
		texture = role === 0 ? 'grp_leader.bmp' : player.state === 0 ? 'grp_online.bmp' : '';
		if (texture) {
			Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/' + texture, function(url){
				node.css('backgroundImage', 'url(' + url + ')');
			});
		}
	};


	/**
	 * Remove a character from list
	 *
	 * @param {number} account id
	 */
	PartyFriends.removePartyMember = function removePartyMember( AID )
	{
		if (AID === Session.AID) {
			_party.length = 0;

			this.ui.find('.content .party').empty();
			this.ui.find('.partyname').text('');
			this.ui.find('.party.create').show();
			this.ui.find('.party.leave, .party.add').hide();

			ChatBox.addText( DB.getMessage(84), ChatBox.TYPE.BLUE);
			return;
		}

		var i, count = _party.length;

		for (i = 0; i < count; ++i) {
			if (_party[i].AID === AID) {
				_party.splice(i, 1);
				this.ui.find('.content .party .node:eq(' + i + ')').remove();
				break;
			}
		}
	};


	/**
	 * Update player life in interface
	 *
	 * @param {number} account id
	 * @param {canvas} canvas life element
	 * @param {number} hp
	 * @param {number} maxhp
	 */
	PartyFriends.updateMemberLife = function updateMemberLife(AID, canvas, hp, maxhp)
	{
		var i, count = _party.length;

		for (i = 0; i < count; ++i) {
			if (_party[i].AID === AID) {
				var node = this.ui.find('.content .party .node:eq(' + i + ')');
				var ctx  = node.find('canvas').get(0).getContext('2d');

				ctx.drawImage(canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
				node.find('.hp').text(hp + '/' + maxhp);
				break;
			}
		}
	};


	/**
	 * Close the window
	 */
	function onClose()
	{
		PartyFriends.ui.hide();
	}


	/**
	 * Enable or disable the lock features
	 */
	function onToggleLock()
	{
		_preferences.lock = !_preferences.lock;
		_preferences.save();

		if (_preferences.lock) {
			PartyFriends.ui.find('.lock.on').show();
			PartyFriends.ui.find('.lock.off').hide();
		}
		else {
			PartyFriends.ui.find('.lock.on').hide();
			PartyFriends.ui.find('.lock.off').show();
		}
	}


	/**
	 * Move to the other tab (Friend -> Party or Party -> Friend)
	 */
	function onChangeTab()
	{
		var ui = PartyFriends.ui;

		_preferences.friend = !_preferences.friend;
		_preferences.save();

		// Initialize the tab
		if (_preferences.friend) {
			ui.find('.friend').show();
			ui.find('.party').hide();
		}
		else {
			ui.find('.friend').hide();
			ui.find('.party').show();

			if (Session.hasParty) {
				ui.find('.party.create').hide();

				if (!Session.isPartyLeader) {
					ui.find('.party.add').hide();
				}
			}
			else {
				ui.find('.party.add, .party.leave').hide();
			}
		}

		ui.find('.node').removeClass('.selection');
		_index = -1;
	}


	/**
	 * Ask confirmation to remove a character from the list
	 */
	function onRequestRemoveSelection()
	{
		if (_index < 0 || _preferences.lock) {
			return;
		}

		var text = _preferences.friend ? DB.getMessage(356) : DB.getMessage(363);

		// Are you sure that you want to delete/expel ?
		UIManager.showPromptBox( text, 'ok', 'cancel', function(){
			if (_preferences.friend) {
				PartyFriends.onRemoveFriend(_index);
			}
			else {
				PartyFriends.onExpelMember( _party[_index].AID, _party[_index].characterName);
			}
		});
	}


	/**
	 * Add nick name to chatbox
	 * Or open a new conversation window (todo)
	 */
	function onRequestPrivateMessage()
	{
		if (_index < 0 || _preferences.lock) {
			return;
		}

		if (_preferences.friend) {
			ChatBox.ui.find('.username').val(_friends[_index].Name);
		}
		else {
			ChatBox.ui.find('.username').val(_party[_index].characterName);
		}

		ChatBox.ui.find('.message').select();
	}


	/**
	 * Right click on a character
	 */
	function onRightClickInfo()
	{
		if (_preferences.lock) {
			return;
		}

		ContextMenu.remove();
		ContextMenu.append();

		if (_preferences.friend) {
			ContextMenu.addElement( DB.getMessage(360), onRequestPrivateMessage);

			if (_friends[_index].GID !== Session.GID) {
				ContextMenu.addElement( DB.getMessage(351), onRequestRemoveSelection);
			}
		}
		else {
			ContextMenu.addElement( DB.getMessage(129), onRequestInformation);

			if (_party[_index].GID === Session.GID) {
				ContextMenu.addElement( DB.getMessage(2055), onRequestLeaveParty);
			}
			else {
				ContextMenu.addElement( DB.getMessage(360), onRequestPrivateMessage);

				if (Session.isPartyLeader) {
					ContextMenu.addElement( DB.getMessage(97),   onRequestRemoveSelection);
					ContextMenu.addElement( DB.getMessage(1532), onRequestPartyDelegation);
				}
			}
		}
	}


	/**
	 * Request player information
	 * (Not implemented yet in official client)
	 */
	function onRequestInformation()
	{
		if (_preferences.lock) {
			return;
		}

		// Not implemented yet
		UIManager.showMessageBox( DB.getMessage(191), 'ok');
	}


	/**
	 * Request to leave a party
	 */
	function onRequestLeaveParty()
	{
		if (_preferences.lock) {
			return;
		}

		// Are you sure that you want to leave ?
		UIManager.showPromptBox( DB.getMessage(357), 'ok', 'cancel', function(){
			PartyFriends.onRequestLeave();
		});
	}


	/**
	 * Request to change party leader
	 * (need to be the leader)
	 */
	function onRequestPartyDelegation()
	{
		if (_preferences.lock) {
			return;
		}

		// Do you want to delegate the real party?
		UIManager.showPromptBox( DB.getMessage(1533), 'ok', 'cancel', function(){
			PartyFriends.onRequestChangeLeader( _party[_index].AID );
		});
	}


	/**
	 * Change selection (click on a friend/party)
	 */
	function onSelectionChange()
	{
		PartyFriends.ui.find('.content .name').removeClass('selection');
		this.classList.add('selection');

		_index = PartyFriends.ui.find(this.parentNode.parentNode).find('.name').index(this);
	}


	/**
	 * Callbacks to define
	 */
	PartyFriends.onRemoveFriend        = function(){};
	PartyFriends.onRequestLeave        = function(){};
	PartyFriends.onExpelMember         = function(){};
	PartyFriends.onRequestChangeLeader = function(){};
	PartyFriends.onRequestAddingMember = function(){};
	PartyFriends.onRequestCreateParty  = function(){};


	/**
	 * Export
	 */
	return UIManager.addComponent(PartyFriends);
});