function Events(){
	this.events = {};
	this.addEventListener = function(id,event,callback,condition){
		if(typeof condition == 'undefined')condition = null;
		this.events[id+event] = {
			event: event,
			callback: callback,
			condition: condition
		};
	}
	
	this.removeEventListener = function(id,event){
		delete this.events[id+event];
	}
	
	this.dispatchEvent = function(event,arguments){
		for(var eventId in this.events){
			if(this.events[eventId].event == event){
				if(
					(this.events[eventId].condition != null && this.events[eventId].condition(arguments)) == true || 
					this.events[eventId].condition == null
				)
					this.events[eventId].callback(arguments);
			}
		}
	}
}

function BaseModel(){
	jQuery.extend(this,new Events);
	
	// Baisc Stuff
	
	this.dom = null;
	this.name = null;
	
	// Attributes
	
	this.attributes = new Array();
	
	this.setAttributes = function(attributes){
		for(var attributeKey in attributes){
			if(attributeKey.split(':')[0] == 'many'){
				var attributeObject = new HasMany(attributeKey.split(':')[1],attributes[attributeKey],this);
			}
			else {
				var attributeObject = {
					name: attributeKey,
					label: attributes[attributeKey],
					dom:$('*[modelKey="' + attributeKey + '"]',this.dom),
					multiple: null,
					value:null,
					isMany: false
				};
		
				var $this = this;
				$(attributeObject.dom).bind('change keyup keydown',function(event){
					$this.setAttributeValue($(this).attr('modelKey'),$(this).val());
				});
			}
			this.attributes.push(attributeObject);
		}
	}
	
	this.setDom = function(dom){
		this.dom = dom;
	}
	
	this.getDom = function(){
		return this.dom;
	}
	
	this.setName = function(name){
		this.name = name;
	}
	
	this.getName = function(){
		return this.name;
	}
	
	this.getAttribute = function(name){
		for(var index in this.attributes){
			if(this.attributes[index].name == name)
				return this.attributes[index];
		}
	}
	
	this.getAttributeValue = function(name){
		return this.getAttribute(name).value;
	}
	
	this.setAttributeValue = function(name,value){
		var attribute = this.getAttribute(name);
		if(attribute){
			attribute.value = value;
			this.dispatchEvent('change',attribute);
		}
	}
	
	// Form
	this.form;
	
	this.getForm = function(){
		if(this.form == null)
			this.form = new ModelForm(this);
		return this.form;
	}
	
	//Serialize and Others
	
	this.onCreate = function(){}
	
	this.unserialize = function(serial){
		var data = typeof serial != 'object' ? jQuery.parseJSON(serial) : serial;
		for(var index in data){
			if(data[index] instanceof Array){
				this.getAttribute(index).unserialize(data[index]);
			}
			else {
				this.setAttributeValue(index,data[index]);
			}
		}
	}
	
	this.serialize = function(returnString){
		var data = {};
		for(var index in this.attributes){
			if(this.attributes[index].isMany == true){
				data[this.attributes[index].name] = this.attributes[index].serialize();
			}
			else data[this.attributes[index].name] = this.attributes[index].value;
		}
		if(returnString == true){
			return JSON.stringify(data);
		}
		else return data;
	}
}

function HasMany(name, className,owner){
	jQuery.extend(this,new Events);
	
	this.name = name;
	this.className = className;
	this.owner = owner;
	this.isMany = true;
	this.attributes = new Array();
	
	
	this.add = function(item){
		this.attributes.push(item);
		this.dispatchEvent('add',item);
		return item;
	}
	
	this.remove = function(item){
		for(var index in this.attributes){
			if(this.attributes[index] == item){
				this.dispatchEvent('remove',this.attributes[index]);
				delete this.attributes[index];
			}
		}
	}
	
	this.create = function(form,data){
		var newClass = new this.className();
		var $this = this;
		newClass.owner = this.owner;
		newClass.remove = function(noConfirm){
			newClass.dispatchEvent('remove',newClass);
			if(typeof noConfirm == 'undefined' || noConfirm == false){
				$('<div title="Warning" class="warning-dialog"><span class="ui-icon ui-icon-alert"></span>Are you sure you want to delete this?</div>').dialog({
						resizable: false,
						height:150,
						modal: true,
						buttons: {
							Delete: function() {
								newClass.remove(true);
								$( this ).dialog( "close" );
							},
							Cancel: function() {
								$( this ).dialog( "close" );
							}
						}
					});
			}
			else {
				newClass.getDom().remove();
				$this.remove(newClass);
			}
		}
		newClass.onCreate();
		if(typeof form != 'undefined' && form == true){
			newClass.getForm().addEventListener('waitToAdd','save',
				function(){
					newClass.getForm().removeEventListener('waitToAdd','save');
					$this.add(newClass);
				}
			);
			newClass.getForm().showForm();
		}
		else {
			this.add(newClass);
			if(typeof data != 'undefined')
				newClass.unserialize(data);
		}
		return newClass;
	}
	
	this.getByKeyValue = function(key,value){
		for(var index in this.attributes){
			if(this.attributes[index][key] == value)
				return this.attributes[index];
		}
	}
	
	this.unserialize = function(data){
		for(index in data)
			this.create(false,data[index]);
	}
	
	this.serialize = function(returnString){
		var data = new Array();
		for(var index in this.attributes){
			data.push(this.attributes[index].serialize());
		}

		if(returnString == true){
			return JSON.stringify(data);
		}
		else return data;
	}
}

function ModelForm(model){
	jQuery.extend(this,new Events);
	
	this.model = model;
	this.form;
	
	this.createForm = function(){
		var form = document.createElement('div');
		$(form).addClass('modelForm');
		$(form).attr('title',this.model.name);
		for(var index in this.model.attributes){
			var attribute = this.model.attributes[index];
			if(attribute.isMany == true)continue;
			
			var label = document.createElement('label');
			$(label).html(attribute.label);
			
			if(attribute.multiple != null){
				var input = document.createElement('select');
				if(attribute.name == 'color'){
					$(input).bind('change',function(){
						$(input).css('background-color',$(input).val());
					});
				}
				$(input).attr('name',attribute.name);
				for(var key in attribute.multiple){
					var option = document.createElement('option');
					if(attribute.name == 'color')
						$(option).css('background-color',key);
					$(option).attr('value',key);
					$(option).html(attribute.multiple[key]);
					if(key == attribute.value)
						$(option).attr('selected','true');
					$(option).appendTo(input);
				}
				$(input).trigger('change');
			}
			else {
				var input = document.createElement('input');
				$(input).attr('name',attribute.name).attr('value',attribute.value);
			}
			var container = document.createElement('div');
			$(label).appendTo(container);
			$(input).appendTo(container);
			$(container).appendTo(form);
		}
		this.form = form;
	}
	
	this.save = function(){
		$this = this;
		$(':input',this.form).each(function(){
			$this.model.setAttributeValue($(this).attr('name'),$(this).val());
		});
		this.dispatchEvent('save',$(':input',this.form));
	}
	
	this.showForm = function(){
		this.createForm();
		var $this = this;
		
		$(document).bind('keypress.formDialog',function(event){
			try {
				if(event.charCode == '13' || event.keyCode == '13'){
					var nextElement = $('*:input',$('*:focus').parent().next());
					if(nextElement.length == 1){
						nextElement.focus();
					}
					else {
						$this.save();
						$($this.form).dialog('close');
					}
				}
			}catch(e){};
		});
		
		$(this.form).dialog({
			modal: true,
			resizable: false,
			width: 400,
			buttons: {
				'Cancel': function(){
					$(this).dialog('close');
				},
				'Save': function(){
					$this.save();
					$(this).dialog('close');
				}
			},
			close: function(){
				$(this).dialog().remove();
				$(document).unbind('keypress.formDialog');
			}
		});
	}
	
	this.hideForm = function(){
		
	}
}

var AgileModel = function(){
	jQuery.extend(this,new BaseModel);
	var $this = this;
	
	this.setAttributes({'many:stages':AgileStageModel});
	this.setName('Board');
	this.setDom($('<div class="board"><div class="actions"><a href="javascript:void(0)" class="create">New Stage</a> <a href="javascript:void(0);" class="save">Save Locally</a> <a href="javascript:void(0);" class="export">Export</a></div><ul class="stages"></ul></div>'));
	$('.create',this.getDom()).click(function(){
		$this.getAttribute('stages').create(true);
	}).button({icons: {primary: 'ui-icon-plus'}});;
	
	$('.save',this.getDom()).click(function(){
		$.cookie('agile',$this.serialize(true));
	}).button({icons: {primary: 'ui-icon-disk'}});
	
	$('.export',this.getDom()).click(function(){
		window.location = 'mailto:malcolm.mcdonald@capitalone.com?subject=Kanban%20Board&body=' + escape($this.serialize(true));
	}).button({icons: {primary: 'ui-icon-arrowthickstop-1-n'}});
	
	// Stages Listener
	this.getAttribute('stages').addEventListener('primaryListener','add',
		function(attribute){
			attribute.dom.appendTo($('.stages'),$this.dom);
			$('.stories',attribute.getDom()).sortable(
				{
					connectWith:'.stories',
					placeholder:'ui-state-highlight',
					handle:'.handle',
					forcePlaceholderSize: true,
					receive: function(event, ui){
						$(ui.item[0]).data('model').moveTo($(event.target).parent().data('model').getAttribute('stories'));
					}
				}
			).disableSelection();
			attribute.addEventListener('agileModel','remove',function(){
				$this.filter.updateFilter();
			});
			attribute.getAttribute('stories').addEventListener('agileModel','add',
				function(storyModel){
					storyModel.addEventListener('agileModel','remove',function(){
						$this.filter.updateFilter();
					});
					storyModel.addEventListener('agileModel','change',
						function(attribute){
							if(attribute.name == 'contributors' || attribute.name == 'pm')
								$this.filter.updateFilter();
						}
					);
					$this.filter.updateFilter();
				}
			);
		}
	);
	
	this.loadRemoteData = function(url,afterCallback){
		var dom = $('<div class="loadingDialog" title="Loading"><span>Loading ... Please Wait.</span></div>');
		dom.dialog({
			'modal': true,
			'closeOnEscape':false,
			'draggable':false,
			'resizable':false
		});
		$('.ui-dialog-titlebar-close',dom.parent()).remove();
		$.getJSON(url,
			function(data){
				$this.unserialize(data);
				$(dom).dialog('close').remove();
				afterCallback();
			}
		);
	}
	
	// This part of the code is VERY ugly. You have been warned.
	this.filter = new (function(){
		this.contributorsDom = $('.contributorsList');
		this.projectManagerDom = $('.projectManagerList');
		
		this.contributorsList = new Array();
		this.projectManagersList = new Array();
		
		this.checkExistance = function(name,array){
			for(var index in array){
				if(array[index] == name)
					return true;
			}
			return false;
		}
		
		this.addName = function(name,array){
			if(this.checkExistance(name,array) == false)
				array.push(name);
		}
		
		this.deleteName = function(name,array){
			for(var index in array){
				if(array[index] == name)
					delete array[index];
			}
		}
		
		this.getNames = function(){
			this.contributorsList = new Array();
			this.projectManagersList = new Array();
			jQuery($this.getAttribute('stages').attributes).each(function(){
				if(this == window)return;
				jQuery(this.getAttribute('stories').attributes).each(function(){
					if(this == window)return;
					var names = this.getAttribute('contributors').value;
					if(names != null){
						names = names.split(',');
						for(var index in names){
							$this.filter.addName(jQuery.trim(names[index]),$this.filter.contributorsList);
						}
					}
					if(this.getAttribute('pm').value != null){
						$this.filter.addName(this.getAttribute('pm').value,$this.filter.projectManagersList);
					}
				});
			});
			this.contributorsList.sort();
			this.projectManagersList.sort();
		}
		
		this.checkContributorsListAgainstValue = function(names){
			var names = names.split(',');
			for(var index in this.contributorsList){
				for(var secondIndex in names){
					if(jQuery.trim(names[secondIndex]) == this.contributorsList[index])
						return true;
				}
			}
			return false;
		}
		
		this.checkProjectManagerListAgainstValue = function(name){
			for(var index in this.projectManagersList){
				if(this.projectManagersList[index] == name)
					return true;
			}
			return false;
		}
		
		this.findStories = function(){
			var stories = new Array();
			jQuery($this.getAttribute('stages').attributes).each(function(){
				if(this == window)return;
				jQuery(this.getAttribute('stories').attributes).each(function(){
					if(this == window)return;
					if($this.filter.checkProjectManagerListAgainstValue(this.getAttribute('pm').value)){
						if($this.filter.checkContributorsListAgainstValue(this.getAttribute('contributors').value)){
							stories.push(this);
						}
					}
				});
			});
			return stories;
		}
		
		this.refreshStories = function(){
			var stories = this.findStories();
			$('li.story').hide();
			for(var index in stories){
				stories[index].getDom().show();
			}
		}
		
		this.isShowingAll = function(node){
			var showingAll = true;
			$(node).siblings().each(function(){
				if($(this).hasClass('showAll'))return;
				if(!showingAll)return;
				if($(this).hasClass('active') == false){
					showingAll = false;
				}
			});
			return showingAll;
		}
		
		this.projectManagerLiAction = function(event,extra){
			if(typeof extra != 'undefined')
				event.altKey = extra.altKey;
				
			var name = $(this).data('name');
			
			if(event.altKey == true){
				if($(this).hasClass('active')){
					$(this).removeClass('active');
					$this.filter.deleteName(name,$this.filter.projectManagersList);
				}
				else {
					$(this).addClass('active');
					$this.filter.addName(name,$this.filter.projectManagersList);
				}
			}
			else {
				var showingAll = $this.filter.isShowingAll(this);
				$(this).siblings().removeClass('active');
				if($(this).hasClass('active') && !showingAll){
					$(this).removeClass('active');
					$this.filter.projectManagersList = new Array();
				}
				else {
					$(this).addClass('active');
					$this.filter.projectManagersList = new Array(name);
				}
			}
			
			if($this.filter.isShowingAll(this)){
				$('.showAll',$(this).parent()).addClass('activeAll');
			}
			else {
				$('.showAll',$(this).parent()).removeClass('activeAll');
			}
			
			$this.filter.refreshStories();
		}
		
		this.contributorsLiAction = function(event,extra){
			
			if(typeof extra != 'undefined')
				event.altKey = extra.altKey;
				
			var name = $(this).data('name');
			
			if(event.altKey == true){
				if($(this).hasClass('active')){
					$(this).removeClass('active');
					$this.filter.deleteName(name,$this.filter.contributorsList);
				}
				else {
					$(this).addClass('active');
					$this.filter.addName(name,$this.filter.contributorsList);
				}
			}
			else {
				var showingAll = $this.filter.isShowingAll(this);
				$(this).siblings().removeClass('active');
				if($(this).hasClass('active') && !showingAll){
					$(this).removeClass('active');
					$this.filter.contributorsList = new Array();
				}
				else {
					$(this).addClass('active');
					$this.filter.contributorsList = new Array(name);
				}
			}
			
			if($this.filter.isShowingAll(this)){
				$('.showAll',$(this).parent()).addClass('activeAll');
			}
			else {
				$('.showAll',$(this).parent()).removeClass('activeAll');
			}
			
			$this.filter.refreshStories();
		}
		
		this.updateFilter = function(){
			this.getNames();
			// PMs
			this.projectManagerDom.children().remove();
			var showAll = $('<li class="showAll activeAll">Show All</li>');
			showAll.click(function(){
				$(this).siblings().each(function(){
					if(!$(this).hasClass('active'))
						$(this).trigger('click',{altKey:true});
				});
			});
			showAll.appendTo(this.projectManagerDom);
			for(var index in this.projectManagersList){
				var dom = $('<li>' + this.projectManagersList[index] + '</li>');
				dom.addClass('active');
				dom.data('name',this.projectManagersList[index]);
				dom.click(this.projectManagerLiAction);
				dom.appendTo(this.projectManagerDom);
			}
			
			// Contributors
			this.contributorsDom.children().remove();
			var showAll = $('<li class="showAll activeAll">Show All</li>');
			showAll.click(function(){
				$(this).siblings().each(function(){
					if(!$(this).hasClass('active'))
						$(this).trigger('click',{altKey:true});
				});
			});
			showAll.appendTo(this.contributorsDom);
			for(var index in this.contributorsList){
				var dom = $('<li>' + this.contributorsList[index] + '</li>');
				dom.addClass('active');
				dom.data('name',this.contributorsList[index]);
				dom.click(this.contributorsLiAction);
				dom.appendTo(this.contributorsDom);
			}
		}
	});
}

var AgileStageModel = function(){
	jQuery.extend(this,new BaseModel);
	var $this = this;
	
	this.setName('Stage');
	this.setAttributes(
		{
			'name':			'Name',
			'color':		'Color',
			'many:stories':	AgileStageStoryModel
		}
	);

	this.getAttribute('color').multiple = {
		'#FFFEE4':'White',
		'#FFC8BA':'Red',
		'#FFBE40':'Orange',
		'#D3EBC7':'Light Green',
		'#B3CC57':'Dark Green',
		'#D0ECEA':'Light Blue',
		'#B5D8EB':'Dark Blue'
	};
	
	this.onCreate = function(){
		var html =	'<li class="stage">';
		html+=			'<div class="actions">';
		html+=				'<button class="edit"/>';
		html+=				'<button class="delete"/>';
		html+=				'<button class="create"/>';
		html+=			'</div>';
		html+=			'<span class="name"></span>';
		html+=			'<ul class="stories"></ul>';
		html+=		'</li>';
		this.setDom($(html));
		this.getDom().data('model',this);
		// Create
		$('.create',this.getDom()).click(
			function(){
				$this.getAttribute('stories').create(true);
			}
		).button(
			{
				icons: {
					primary: 'ui-icon-plus'
				},
				text: false
			}
		);
		
		// Edit
		$('.edit',this.getDom()).click(
			function(){
				$this.getForm().showForm();
			}
		).button(
			{
				icons: {
					primary: 'ui-icon-pencil'
				},
				text: false
			}
		);
		
		// Delete
		$('.delete',this.getDom()).click(
			function(){
				$this.remove();
			}
		).button(
			{
				icons: {
					primary: 'ui-icon-minus'
				},
				text: false
			}
		);
	}
	
	this.updateColors = function(){
		$('li',$this.getDom()).css('background-color',$this.getAttribute('color').value);
	}
	
	// Change of this.
	this.addEventListener('primaryListener','change',
		function(attribute){
			$this.updateColors();
			$('.' + attribute.name,$this.getDom()).html(attribute.value);
		}
	);
	
	
	// Stories Listener.
	this.getAttribute('stories').addEventListener('primaryListener','add',
		function(attribute){
			attribute.getDom().appendTo($('.stories',$this.getDom()));
			$this.updateColors();
		}
	);
	
}

var AgileStageStoryModel = function(){
	jQuery.extend(this,new BaseModel);
	var $this = this;
	this.setName('Story');
	
	this.setAttributes(
		{
			'title':		'Title',
			'strategy':		'Strategy Number',
			'loe':			'Level of Effort',
			'type':			'Project Type',
			'lob':			'Line of Business',
			'pm':			'Project Manager',
			'status':		'Status',
			'contributors':	'Contributors'
		}
	);
	
	this.getAttribute('type').multiple = {
		'S':	'Standard',
		'H':	'House',
		'DP':	'Direct Pull',
		'DPT':	'Direct Pull with Changes'
	};
	
	this.getAttribute('lob').multiple = {
		'DB':		'Direct Banking',
		'BB':		'Branch Banking',
		'SB':		'Small Business',
		'CCM':		'Card Customer Management',
		'CMA':		'Card Customer Acquisition',
		'COAF':		'Auto Finance',
		'EOS':		'Enterprise Online Services',
		'CAN':		'Canada',
		'OTHER':	'Other'
	};
	
	this.getAttribute('status').multiple = {
		'green':'Green',
		'yellow':'Yellow',
		'red':'Red'
	};
	
	this.onCreate = function(){
		var html =	'<li class="story">';
		html+=			'<div class="handle"></div>';
		html+=			'<div class="actions">';
		html+=				'<button class="edit"/>';
		html+=				'<button class="delete"/>';
		html+=			'</div>';
		html+=			'<div class="header">';
		html+=				'<span class="strategy"></span>';
		html+=				'&nbsp;-&nbsp;';
		html+=				'<span class="pm"></span>';
		html+=			'</div>';
		html+=			'<div class="right">';
		html+=				'<span class="loe"></span>';
		html+=				'<span class="status"></span>';
		html+=				'<span class="type"></span>';
		html+=				'<span class="lob"></span>';
		html+=			'</div>';
		html+=			'<span class="title"></span>';
		html+=			'<span class="contributors"></span>';
		html+=		'</li>';
		this.setDom($(html));
		this.getDom().data('model',this);
		// Edit
		$('.edit',this.getDom()).click(
			function(){
				$this.getForm().showForm('transfer');
			}
		).button(
			{
				icons: {
					primary: 'ui-icon-pencil'
				},
				text: false
			}
		);
		
		// Delete
		$('.delete',this.getDom()).click(
			function(){
				$this.remove();
			}
		).button(
			{
				icons: {
					primary: 'ui-icon-minus'
				},
				text: false
			}
		);
	}
	
	// Change of this
	this.addEventListener('primaryListener','change',
		function(attribute){
			if(attribute.name == 'status'){
				$('.' + attribute.name,$this.getDom()).attr('class','').addClass(attribute.name).addClass(attribute.value);
			}
			else if(attribute.name == 'contributors'){
				$this.getDom().attr('class','story');
				var splitted = attribute.value.split(',');
				var theContributors = '<ul>';
				for(var index in splitted){
					$this.getDom().addClass('contributor_' + splitted[index]);
					theContributors += '<li>' + jQuery.trim(splitted[index]) + '</li>';
				}
				theContributors += '</ul>';
				$('.' + attribute.name,$this.getDom()).html(theContributors);
			}
			else {
				$('.' + attribute.name,$this.getDom()).html(attribute.value);
			}
		}
	);
	
	
	// Move To
	
	this.moveTo = function(where){
		where.add(this);
		var ownerStories = this.owner.getAttribute('stories');
		for(var index in ownerStories.attributes){
			if(ownerStories.attributes[index] == this)
				delete ownerStories.attributes[index];
		}
		this.owner = where.owner;
	}
}

$(function(){
	// EDITOR
	$('#editorOptions').buttonset();
	var editorChange = function(){
		if($('input[name="editor"]:checked').val() == 'true')
			$('.actions').show();
		else $('.actions').hide();
	}
	$('input[name="editor"]').change(editorChange);
	$('.actions').live('ready',editorChange);

	
	// MODEL
	agileBoard = new AgileModel();
	agileBoard.getDom().appendTo($('#container'));
	/*if($.cookie('agile') != null){
		agileBoard.unserialize($.cookie('agile'));
	}
	else {
		var stages = agileBoard.getAttribute('stages');
		var defaultStages = ['Concepts','Creative Lean','Prod Proof','Final Proof','Testing','Launch'];
		for(var index in defaultStages){
			stages.create(false,{name:defaultStages[index]});
		}
	}*/
	agileBoard.loadRemoteData('./data.json',editorChange);
});