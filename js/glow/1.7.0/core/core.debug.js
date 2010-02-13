/*	
	Copyright 2009 British Broadcasting Corporation

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	   http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/
/**
@name glow
@namespace
@version 1.7.0 (2008-09-22)
@description The glow namespace and core library.

    Includes common methods for running scripts onDomReady and user agent sniffing.
*/
(function() {
	/*
	PrivateVar: moduleRegister
		Holds info on which modules are registered {name:true}
	*/
	var moduleRegister = {glow: true},
		/*
		PrivateVar: regexEscape
			For escaping strings to go in regex
		*/
		regexEscape = /([$^\\\/()|?+*\[\]{}.-])/g,
		/*
		PrivateVar: ua
			A lowercase representation of the user's useragent string
		*/
		ua = navigator.userAgent.toLowerCase(),
		//glow version
		version = "1.7.0",
		// number of blockers blocking (when it's zero, we're ready)
		blockersActive = 0,
		/*
		PrivateMethod: domReadyQueue
			array of functions to call when dom is ready
		*/
		domReadyQueue = [],
		domReadyQueueLen = 0,
		/*
		PrivateMethod: readyQueue
			array of functions to call when all ready blockers are unblocked
		*/
		//we want to set isReady to true when this is first run
		readyQueue = [],
		readyQueueLen = 0,
		// stops two instances of 'runReadyQueue' fighting on the call stack
		processingReadyQueue = false,
		glow = {
			/**
			@name glow.VERSION
			@description Version of glow
				This is in the format 1.2.3

			@type String

			@see <a href="/glow/docs/previous_versions.shtml#versionScheme">Glow's versioning scheme</a>
			*/
			VERSION: version,

			/**
			@name glow.UID
			@description A unique ID for this instance of Glow

				This will be used in glow-specific property names
				that need to be unique to this instance of glow.

			@type String
			*/
			UID: "glow" + Math.floor(Math.random() * (1<<30)),

			/**
			@name glow.isDomReady
			@description Is the DOM ready?

			 	If glow is loaded after the page has loaded (by means other than Gloader)
			 	this value should be set manually.

			@type Boolean
			*/
			//check gloader to see if dom is already ready
			isDomReady: window.gloader && gloader.isReady,
			
			/**
			@name glow.isReady
			@description Is Glow ready?

			 	Set to true when Glow is ready. This includes DOM ready,
			 	a supported browser and any additional requirements. For example
			 	Glow widgets will add the loading of their CSS file as a requirement.

			@type Boolean
			*/
			//check gloader to see if dom is already ready
			isReady: window.gloader && gloader.isReady,

			/**
			@name glow.env
			@description Information about the browser / platform
			@type Object

			@example
				if (glow.env.ie < 7) {
					//this only runs in IE 6 and below
				}
				if (glow.env.gecko < 1.9) {
					//this only runs in Gecko versions less than 1.9
					//Wikipedia can be used to link engine versions to browser versions
				}
			*/
			/**
			@name glow.env.gecko
			@description Gecko version number to one decimal place (eg 1.9) or NaN
			@type Number
			*/
			/**
			@name glow.env.ie
			@description IE version number or NaN
			@type Number
			*/
			/**
			@name glow.env.opera
			@description Opera version (eg 8.02) or NaN
			@type Number
			*/
			/**
			@name glow.env.webkit
			@description Webkit version number to one decimal place (eg 419.3) or NaN
			@type Number
			*/
			/**
			@name glow.env.khtml
			@description KHTML version number to one decimal place or NaN
			@type Number
			*/
			/**
			@name glow.env.standardsMode
			@description True if the browser reports itself to be in 'standards mode'
			@type Boolean
			*/
			/**
			@name glow.env.version
			@description Browser version as a string. Includes non-numerical data, eg "1.8.1" or "7b"
			@type String
			*/
			env: function(){
				var nanArray = [0, NaN],
					opera = (/opera[\s\/]([\w\.]+)/.exec(ua) || nanArray)[1],
					ie = opera ? NaN : (/msie ([\w\.]+)/.exec(ua) || nanArray)[1],
					gecko = (/rv:([\w\.]+).*gecko\//.exec(ua) || nanArray)[1],
					webkit = (/applewebkit\/([\w\.]+)/.exec(ua) || nanArray)[1],
					khtml = (/khtml\/([\w\.]+)/.exec(ua) || nanArray)[1],
					toNum = parseFloat;

				return {
					gecko   : toNum(gecko),
					ie      : toNum(ie),
					opera   : toNum(opera),
					webkit  : toNum(webkit),
					khtml   : toNum(khtml),
					version : ie || gecko || webkit || opera || khtml,
					standardsMode : document.compatMode != "BackCompat" && (!ie || ie >= 6)
				}
			}(),

			/**
			@name glow.module
			@private
			@function
			@description Registers a new module with the library, checking version numbers &amp; dependencies.

			@param {Object} meta
				Object containing all of the following. This object is
				compatible with gloader.module, hence some properties which seem
				unnecessary here. This is all simplified by glow's module pattern.

			@param {String} meta.name Name of the module.
				Eg. "glow.dom" or "glow.widgets.Panel"

			@param {String[]} meta.library Information about Glow.
				This must be ["glow", "1.7.0"]. 1.7.0 should be
				the version number of glow expected.

			@param {String[]} meta.depends The module's dependencies.
				This must start ["glow", "1.7.0"], followed by modules
				such as "glow.dom". 1.7.0 should be the version number
				of glow expected.

			@param {Function} meta.builder The module's implementation.
				A reference to glow will be passed in as the first parameter
				to this function. Add to that object to create publicly
				accessabile properties. Anything else in this function
				will be private.

			@returns {Object} Glow

			@example
				glow.module({
					name: "glow.anim",
					library: ["glow", "1.0.0"],
					depends: ["glow", "1.0.0", "glow.dom"],
					builder: function(glow) {
						glow.anim = {
							//...
						};
					}
				});
			*/
			module: function(meta) {
				var i = 2,
					depends = meta.depends[0] || [],
					dependsLen = depends.length,
					name = meta.name,
					objRef = window.glow; //holds the parent object for the new module

				//check version number match core version
				if (meta.library[1] != glow.VERSION) {
					throw new Error("Cannot register " + name + ": Version mismatch");
				}

				//check dependencies loaded
				if (depends[2]) {
					for (; i < dependsLen; i++) {
						//check exists
						if (!moduleRegister[depends[i]]) {
							//check again ondomready to detect if modules are being included in wrong order
							throw new Error("Module " + depends[i] + " required before " + name);
						}
					}
				}

				//create module
				meta.builder(glow);
				//register it as built
				moduleRegister[name] = true;
				return glow;
			},

			/**
			@name glow.ready
			@function
			@description Calls a function when the DOM had loaded and the browser is supported
			
				"ready" also waits for glow's CSS file to load if it has been
				requested.

			@param {Function} callback Function to call

			@returns {glow}

			@example
				glow.ready(function() {
					alert("DOM Ready!");
				});
			*/
			ready: function(f) {
				//just run function if already ready
				if (this.isReady) {
					f();
				} else {
					readyQueue[readyQueueLen++] = f;
				}
				return this;
			},
			
			/**
			@name glow._readyBlockers
			@private
			@object
			@description A hash (by name) of blockers.
				True if they are blocking, false if they've since unblocked
			*/
			_readyBlockers: {},
			
			/**
			@name glow._addReadyBlock
			@private
			@function
			@description Adds a blocker to anything added via glow.ready.
				Uncalled callbacks added via glow.ready will not fire until
				this block is removed

			@param {String} name Name of blocker

			@returns {glow}

			@example
				glow._addReadyBlock("widgetsCss");
				
				// when CSS is ready...
				glow._removeReadyBlock("widgetsCss");
			*/
			_addReadyBlock: function(name) {
				if (name in glow._readyBlockers) {
					throw new Error("Blocker '" + name +"' already exists");
				}
				glow._readyBlockers[name] = true;
				glow.isReady = false;
				blockersActive++;
				return glow;
			},
			
			/**
			@name glow._removeReadyBlock
			@private
			@function
			@description Removes a ready blocker added via glow._addReadyBlock

			@param {String} name Name of blocker

			@returns {glow}

			@example
				glow._addReadyBlock("widgetsCss");
				
				// when CSS is ready...
				glow._removeReadyBlock("widgetsCss");
			*/
			_removeReadyBlock: function(name) {
				if (glow._readyBlockers[name]) {
					glow._readyBlockers[name] = false;
					blockersActive--;
					// if we're out of blockers
					if (!blockersActive) {
						// call our queue
						glow.isReady = true;
						runReadyQueue();
					}
				}
				return glow;
			},

			/**
			@name glow.onDomReady
			@function
			@description Calls a function when / if the DOM is ready.

				This function does not wait for glow's CSS to load, nor
				does it block unsupported browsers. If you want these features,
				use {@link glow.ready}

			@param {Function} callback Function to call

			@returns {glow}

			@exmaple
				glow.onDomReady(function() {
					alert("DOM Ready!");
				});
			*/
			onDomReady: function(f) {
				//just run function if already ready
				if (this.isDomReady) {
					f();
				} else {
					domReadyQueue[domReadyQueueLen++] = f;
				}
			},

			/**
			@name glow.lang
			@namespace
			@description Useful language functions.
			@see <a href="../furtherinfo/glow/glow.lang.shtml">Using glow.lang.clone</a>
			*/
			lang: {
				/**
				@name glow.lang.trim
				@function
				@description Removes leading and trailing whitespace from a string

				@param {String} str String to trim

				@returns {String}

					String without leading and trailing whitespace

				@example
				 	glow.lang.trim("  Hello World  "); // "Hello World"
				*/
				trim: function(sStr) {
					//this optimisation from http://blog.stevenlevithan.com/archives/faster-trim-javascript
					return sStr.replace(/^\s*((?:[\S\s]*\S)?)\s*$/, '$1');
				},

				/**
				@name glow.lang.toArray
				@function
				@description Converts an array-like object to a real array

				@param {Object} arrayLike Any array-like object

				@returns {Array}

				@example
				 	var a = glow.lang.toArray(glow.dom.get("a"));
				*/
				toArray: function(aArrayLike) {
					if (aArrayLike.constructor == Array) {
						return aArrayLike;
					}
					//use array.slice if not IE? Could be faster
					var r = [], i=0, len = aArrayLike.length;
					for (; i < len; i++) {
						r[i] = aArrayLike[i];
					}
					return r;
				},

				/**
				@name glow.lang.apply
				@function
				@description Copies properties from one object to another

				@param {Object} destination Destination object

				@param {Object} source Properties of this object will be copied onto the destination

				@returns {Object}

				@example
					var obj = glow.lang.apply({foo: "hello", bar: "world"}, {bar: "everyone"});
					//results in {foo: "hello", bar: "everyone"}
				*/
				apply: function(destination, source) {
					for (var i in source) {
						destination[i] = source[i];
					}
					return destination;
				},

				/**
				@name glow.lang.map
				@function
				@description Runs a function for each element of an array and returns an array of the results

				@param {Array} array Array to loop over
				@param {Function} callback The function to run on each element. This function is passed three params, the array item, its index and the source array.
				@param {Object} [context] The context for the callback function (the array is used if not specified)

				@returns {Array}

					Array containing one element for each value returned from the callback

				@example
					var weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
					var weekdaysAbbr = glow.lang.map(weekdays, function (day) {
						return day.slice(0, 3).toLowerCase();
					});
					// returns ["mon", "tue", "wed", "thu", "fri"]
				*/
				map: function (arr, callback, context) {
					if (Array.prototype.map) { return Array.prototype.map.call(arr, callback, context || arr); }
					if (! callback.call) { throw new TypeError(); }

					var len = arr.length,
						res = [],
						thisp = context || arr,
						i = 0;

					for (; i < len; i++) {
						if (i in arr) {
							res[i] = callback.call(thisp, arr[i], i, arr);
						}
					}
					return res;
				},

				/**
				@name glow.lang.replace
				@function
				@description Makes a replacement in a string.

					Has the same interface as the builtin
					String.prototype.replace method, but takes the input
					string as the first parameter. In general the native string
					method should be used unless you need to pass a function as the
					second parameter, as this method will work accross our
					supported browsers.

				@param {String} str Input string

				@param {String | RegExp} pattern String or regular expression to match against

				@param {String | Function} replacement String to make replacements with, or a function to generate the replacements

				@returns {String}
					A new string with the replacement(s) made

				@example
					var myDays = '1 3 6';
					var dayNames = glow.lang.replace(myDays, /(\d)/, function (day) {
						return " MTWTFSS".charAt(day - 1);
					});
					// dayNames now contains "M W S"
				*/
				replace: (function () {
					var replaceBroken = "g".replace(/g/, function () { return 'l'; }) != 'l',
						def = String.prototype.replace;
					return function (inputString, re, replaceWith) {
						var pos, match, last, buf;
						if (! replaceBroken || typeof(replaceWith) != 'function') {
							return def.call(inputString, re, replaceWith);
						}
						if (! (re instanceof RegExp)) {
							pos = inputString.indexOf(re);
							return pos == -1 ?
								inputString :
								def.call(inputString, re, replaceWith.call(null, re, pos, inputString));
						}
						buf = [];
						last = re.lastIndex = 0;
						while ((match = re.exec(inputString)) != null) {
							pos = match.index;
							buf[buf.length] = inputString.slice(last, pos);
							buf[buf.length] = replaceWith.apply(null, match);
							if (re.global) {
								last = re.lastIndex;
							} else {
								last = pos + match[0].length;
								break;
							}
						}
						buf[buf.length] = inputString.slice(last);
						return buf.join("");
					};
				})(),

				/**
				@name glow.lang.interpolate
				@function
				@description Replaces placeholders in a string with data from an object

				@param {String} template The string containing {placeholders}
				@param {Object} data Object containing the data to be merged in to the template
					<p>The object can contain nested data objects and arrays, with nested object properties and array elements are accessed using dot notation. eg foo.bar or foo.0.</p>
					<p>The data labels in the object cannot contain characters used in the template delimiters, so if the data must be allowed to contain the default { and } delimiters, the delimters must be changed using the option below.</p>
				@param {Object} opts Options object
					@param {String} [opts.delimiter="{}"] Alternative label delimiter(s) for the template
						The first character supplied will be the opening delimiter, and the second the closing. If only one character is supplied, it will be used for both ends.
					@param {Boolean} [opts.escapeHtml=false] Escape any special html characters found in the data object
						Use this to safely inject data from the user into an HTML template. The glow.dom module
						must be present for this feature to work (an error will be thrown otherwise).

				@returns {String}

				@example
					var data = {
						name: "Domino",
						colours: ["black", "white"],
						family: {
							mum: "Spot",
							dad: "Patch",
							siblings: []
						}
					};
					var template = "My cat's name is {name}. His colours are {colours.0} & {colours.1}. His mum is {family.mum}, his dad is {family.dad} and he has {family.siblings.length} brothers or sisters.";
					var result = glow.lang.interpolate(template, data);
					// result == "My cat's name is Domino. His colours are black & white. His mum is Spot, his dad is Patch and he has 0 brothers or sisters."
				
				@example
					var data = {
						name: 'Haxors!!1 <script src="hackhackhack.js"></script>'
					}
					var template = '<p>Hello, my name is {name}</p>';
					var result = glow.lang.interpolate(template, data, {
						escapeHtml: true
					});
					// result == '<p>Hello, my name is Haxors!!1 &lt;script src="hackhackhack.js"&gt;&lt;/script&gt;</p>'
				*/
				interpolate : function (template, data, opts) {
					var placeHolderRx,
						leftDelimiter,
						rightDelimiter,
						// div used for html escaping
						div;

					opts = opts || {};
					
					// make sure the dom module is around
					if (opts.escapeHtml) {
						if (!glow.dom) { throw new Error('glow.lang.interpolate - glow.dom is needed for escapeHtml'); }
						div = glow.dom.create('<div></div>');
					}

					if (opts.delimiter == undefined) {
						placeHolderRx = /\{[^{}]+\}/g;
					} else {
						leftDelimiter = opts.delimiter.substr(0, 1).replace(regexEscape, "\\$1");
						rightDelimiter = opts.delimiter.substr(1, 1).replace(regexEscape, "\\$1") || leftDelimiter;
						placeHolderRx = new RegExp(leftDelimiter + "[^" + leftDelimiter + rightDelimiter + "]+" + rightDelimiter, "g");
					}

					return template.replace(placeHolderRx, function (placeholder) {

						var key = placeholder.slice(1, -1),
							keyParts = key.split("."),
							val,
							i = 0,
							len = keyParts.length;
						
						if (key in data) {
							// need to be backwards compatible with "flattened" data.
							val = data[key]; 
						} else {
							// look up the chain
							val = data;
							for (; i < len; i++) {
								if (keyParts[i] in val) {
									val = val[ keyParts[i] ];
								} else {
									return placeholder;
								}
							}
						}
						
						if (opts.escapeHtml) {
							val = div.text(val).html();
						}
						return val;
					});
				},
				/**
				@name glow.lang.hasOwnProperty
				@function
				@description Cross-browser implementation
				@deprecated

				  Safari 1.3 doesn't support
				  <a href="http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Objects:Object:hasOwnProperty">
				    Object.hasOwnProperty
				  </a>, use this method instead.

				@param {Object} obj The object to check

				@param {String} property Property name

				@returns {Boolean}

					Returns false if a property doesn't exist in an object, or it
					was inherited from the object's prototype. Otherwise, returns
					true
				*/
				hasOwnProperty: {}.hasOwnProperty ? //not supported in Safari 1.3
					function(obj, prop) {
						return obj.hasOwnProperty(prop);
					} :
					function(obj, prop) {
						var propVal = obj[prop], //value of the property
							objProto = obj.__proto__, //prototype of obj
							protoVal = objProto ? objProto[prop] : {}; //prototype val
						if (propVal !== protoVal) {
							return true;
						}
						//try changing prototype and see if obj reacts
						var restoreProtoVal = glow.lang.hasOwnProperty(objProto, prop),
							tempObjProtoVal = objProto[prop] = {},
							hasOwn = (obj[prop] !== tempObjProtoVal);

						delete objProto[prop];
						if (restoreProtoVal) {
							objProto[name] = tempObjProtoVal;
						}
						return hasOwn;
					},

				/**
				@name glow.lang.extend
				@function
				@description Copies the prototype of one object to another.

					The 'subclass' can also access the 'base class' via subclass.base

				@param {Function} sub Class which inherits properties.

				@param {Function} base Class to inherit from.

				@param {Object} additionalProperties An object of properties and methods to add to the subclass.

				@example
					function MyClass(arg) {
						this.prop = arg;
					}
					MyClass.prototype = {
						showProp: function() { alert(this.prop); }
					};
					function MyOtherClass(arg) {
						//call the base class's constructor
						arguments.callee.base.apply(this, arguments);
					}
					glow.lang.extend(MyOtherClass, MyClass, {
						setProp: function(newProp) { this.prop = newProp; }
					});

					var test = new MyOtherClass("hello");
					test.showProp(); // alerts "hello"
					test.setProp("world");
					test.showProp(); // alerts "world"
				 *
				 */
				extend: function(sub, base, additionalProperties) {
					var f = function () {}, p;
					f.prototype = base.prototype;
					p = new f();
					sub.prototype = p;
					p.constructor = sub;
					sub.base = base;
					if (additionalProperties) {
						glow.lang.apply(sub.prototype, additionalProperties);
					}
				},

				/**
				@name glow.lang.clone
				@function
				@description Deep clones an object / array

				@param {Object} Data Object to clone

				@returns {Object}

				@example
					var firstObj = { name: "Bob", secondNames: ["is","your","uncle"] };
					var clonedObj = glow.lang.clone( firstObj );
				*/
				clone: function( obj ) {
					var index, _index, tmp;
					obj = obj.valueOf();
					if ( typeof obj !== 'object' ) {
						return obj;
					} else {
						if ( obj[0] || obj.concat ) {
							tmp = [ ];
							index = obj.length;
							while(index--) {
								tmp[index] = arguments.callee( obj[index] );
							}
					} else {
							tmp = { };
							for ( index in obj ) {
								tmp[index] = arguments.callee( obj[index] );
							}
						}
					return tmp;
					}

				}
			}
		},
		env = glow.env,
		d = document;
	
	//dom ready stuff
	//run queued ready functions when DOM is ready
	
	function runDomReadyQueue() {
		glow.isDomReady = true;
		// run all functions in the array
		for (var i = 0; i < domReadyQueueLen; i++) {
			domReadyQueue[i]();
		}
	}
	
	function runReadyQueue() {
		// if we're already processing the queue, just exit, the other instance will take care of it
		if (processingReadyQueue) return;
		processingReadyQueue = true;
		for (var i = 0; i < readyQueueLen;) {
			readyQueue[i]();
			i++;
			// check if the previous function has created a blocker
			if (blockersActive) {
				break;
			}
		}
		// take items off the ready queue that have processed
		readyQueue = readyQueue.slice(i);
		// update len
		readyQueueLen = readyQueueLen - i;
		processingReadyQueue = false;
	}
	
	(function(){
		//don't do this stuff if the dom is already ready
		if (glow.isDomReady) { return; }
		
		glow._addReadyBlock("glow_domReady");
		if (env.ie) {
			if (typeof window.frameElement != 'undefined') {
				// we can't use doScroll if we're in an iframe...
				d.attachEvent("onreadystatechange", function(){
					if (d.readyState == "complete") {
						d.detachEvent("onreadystatechange", arguments.callee);
						runDomReadyQueue();
						glow._removeReadyBlock("glow_domReady");
					}
				});
			} else {
				// polling for no errors
				(function () {
					try {
						// throws errors until after ondocumentready
						d.documentElement.doScroll('left');
					} catch (e) {
						setTimeout(arguments.callee, 0);
						return;
					}
					// no errors, fire
					runDomReadyQueue();
					glow._removeReadyBlock("glow_domReady");
				})();
			}
		} else if (glow.env.webkit < 525.13 && typeof d.readyState != 'undefined') {
			var f = function(){
				if ( /loaded|complete/.test(d.readyState) ) {
					runDomReadyQueue();
					glow._removeReadyBlock("glow_domReady");
				} else {
					setTimeout(f, 0);
				}
			};
			f();
		} else {
			var callback = function () {
				if (callback.fired) { return; }
				callback.fired = true;
				runDomReadyQueue();
				glow._removeReadyBlock("glow_domReady");
			};
			if (d.addEventListener) {
				d.addEventListener("DOMContentLoaded", callback, false);
			}
			var oldOnload = window.onload;
			window.onload = function () {
				if (oldOnload) { oldOnload(); }
				callback();
			};
		}
	})();

	/**
	@name glow.isSupported
	@description Set to true in supported user agents
		This will read false in 'level 2' browsers in BBC's Browser Support Guidelines
	@type Boolean

	@see <a href="http://www.bbc.co.uk/guidelines/newmedia/technical/browser_support.shtml">BBC's Browser Support Guidelines</a>
	*/
	// TODO: for v2 we should switch this to 'notSupported' as it's a blacklist
	glow.isSupported = !(
		//here are the browsers we don't support
		env.ie < 6 ||
		(env.gecko < 1.9 && !/^1\.8\.1/.test(env.version)) ||
		env.opera < 9 ||
		env.webkit < 412
	);
	// block 'ready' if browser isn't supported
	if (!glow.isSupported) {
		glow._addReadyBlock("glow_browserSupport");
	}

	if (window.gloader) {
		gloader.library({
			name: "glow",
			version: "1.7.0",
			builder: function () {
				return glow;
			}
		});
	} else if (window.glow) {
		throw new Error("Glow global object already exists");
	} else {
		window.glow = glow;
	}

	// this helps IE cache background images
	if (glow.ie) {
		try {
			document.execCommand("BackgroundImageCache", false, true);
		} catch(e) {}
	}
})();
/*@cc_on @*/
/*@if (@_jscript_version > 5.5)@*/
/**
@name glow.i18n
@namespace
@description Internationalisation Module.
@requires glow
@see <a href="../furtherinfo/i18n/index.shtml">Using glow.i18n</a>
*/
(window.gloader || glow).module({
	name: "glow.i18n",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0"]],
	builder: function(glow) {
		var self;
		
		// Regexes for judging subtag types in the 'L'anguage, 'S'cript, 'R'egion, 'V'ariant form
		// lv is a match for a subtag that can be either 'L'anguage or 'V'ariant
		// See full explanation of tags and subtags at the end of the file
		var subtagRegexes = {
				l  : /^[a-z]$/,
				lv : /^[a-z]{2,3}$/,
				s  : /^[A-Z][a-z]{3}$/,
				r  : /^[A-Z]{2}|[0-9]{3}$/,
				v  : /^[a-z0-9]{4,}$/
			};

		// Bit masks for tag signature in the 'L'anguage, 'S'cript, 'R'egion, 'V'ariant form
		// See full explanation of tags and subtags at the end of the file
		var L    = 1,
			S    = 2,
			R    = 4,
			V    = 8,
			LSRV = L + S + R + V,
			LRV  = L     + R + V,
			LSV  = L + S     + V,
			LV   = L         + V,
			LSR  = L + S + R    ,
			LR   = L     + R    ,
			LS   = L + S;
	
		// Base structures for tag parsing using 'L'anguage, 'S'cript, 'R'egion, 'V'ariant form
		// See full explanation of tags and subtags at the end of the file
		var masks   = {l: L, s: S, r: R, v: V}, // map subtag types to masks
			subtags = ['l', 's', 'r', 'v'],		// in order
			labels  = {l: 0, s: 1, r: 2, v: 3}; // reverse look up for subtags

		// holds the actual local pack data
		var localePacks = {};

		// holds the main index of the pack / module structure
		var moduleStructure = {};

		// the currently selected locale
		// comes from html lang if it exists and is valid, defaults to 'en'
		var currentLocale = parseTag(document.documentElement.lang || 'en') || parseTag('en');
		
		// Determine what, if any, type of subtag this is by regex matching
		function getSubtagPattern( subtag ) {
			for (var pattern in subtagRegexes) { // These regexes are mutually exclusive, so order is immaterial
				if (subtagRegexes[pattern].test(subtag)) {
					return pattern;
				}
			}
	
			return "";
		}

		// Parse the given tag and return a queryable data set using 'L'anguage, 'S'cript, 'R'egion, 'V'ariant form
		// See full explanation of tags and subtags at the end of the file
		// if the tag is valid, returns the internal representation of a parsed locale tag
		// canonical is the valid canonical form of the tag eg "en-GB", mask is a bitmask indicating which subtag types are present and subtags is an object containing the actual subtags
		function parseTag( tag ) {
			if (!tag.split) {
				tag = "";
			}
		
			var parts = tag.split("-"), // get the subtags
				len = parts.length,
				canon = [],				// will hold the subtags of the canonical tag
				matchedSubtags = {l: "", s:"", r:"", v:""},
				start = 0,
				i = start,
				mask = 0,
				subtag,
				label;
		
			for (var j = 0, jlen = subtags.length; j < jlen; j++) { // order of subtag match is important
				i = start;
				subtag = subtags[j];
				label = labels[subtag];
	
				while ((getSubtagPattern(parts[i]).indexOf(subtag) == -1) && (i < len)) { // indexOf allows for partial match of 'lv' regex
					i++; // if no match, move on
				}
				
				if (i < len) { // if a match is found, store it and continue with the next subtag from this point
					canon[label] = parts[i];
					mask += masks[subtag];
					matchedSubtags[subtag] = parts[i];
					parts[i] = "*";
					start = i;
				}
			}
			
			// put it all back together as a string
			var canonical = canon.join("-").replace(/-+/g, "-");
			
			if ((canonical == "") || (canonical.substring(0, 1) == "-")) { // this means there is no language subtag, so we must fail the parse
				return false;
			}
			else {
				return {canonical: canonical, mask: mask, subtags: matchedSubtags};
			}
		}		
		
		// For a given tag, and mask for a subset of it, return the subset tag using 'L'anguage, 'S'cript, 'R'egion, 'V'ariant form
		// eg for 'en-GB-scouse' and an LR mask, return 'en-GB'
		// See full explanation of tags and subtags at the end of the file
		// ** note the bitwise operations **
		function getSubsetTag( parsed, test, mask ) {
			var subset;
			
			// this test (bitwise because the operands are bitmasks) determines that mask has no bits set that parsed.mask does not
			// this is to make sure that the tag being generated is genuinely a subset of the main tag
			if ((mask & ~parsed.mask) == 0) {
				subset = parsed.subtags["l"]; // there must be a language subtag, because this tags passed the parse
				
				if (S & mask) {
					subset = subset + "-" + parsed.subtags["s"];
				}
				if (R & mask) {
					subset = subset + "-" + parsed.subtags["r"];
				}
				if (V & mask) {
					subset = subset + "-" + parsed.subtags["v"];
				}
	
				if (test(subset)) {
					return subset;
				}
			}
		
			return false;
		}

		// Performs the generic tag negotiation process
		// The test is a function that performs an additional check to see if the subset tag currently being
		// checked should be used, normally based on the presence of appropriate data in the locale packs
		// parsed is the parsed locale tag, as returned by parseTag
		// testFn is the function passed to getSubsetTag, used to determine if a given subste tag is a negotiated hit
		// successFn, failFn are the functions to be run when the negotiation result is known
		function negotiate( parsed, testFn, successFn, failFn ) {
			var subset;
					
			switch(parsed.mask) { // NOTE the breaks are conditional because it might be OK for all the cases to execute - need to move on to the next case if the "if" fails
				case LRV:
					if ((subset = getSubsetTag(parsed, testFn, LRV ))) {
						break;
					}
				case LR:
					if ((subset = getSubsetTag(parsed, testFn, LR  ))) {
						break;
					}
				case LSRV:
					if ((subset = getSubsetTag(parsed, testFn, LSRV))) {
						break;
					}
				case LSR:
					if ((subset = getSubsetTag(parsed, testFn, LSR ))) {
						break;
					}
				case LSV:
					if ((subset = getSubsetTag(parsed, testFn, LSV ))) {
						break;
					}
				case LS:
					if ((subset = getSubsetTag(parsed, testFn, LS  ))) {
						break;
					}
				case LV:
					if ((subset = getSubsetTag(parsed, testFn, LV  ))) {
						break;
					}
				case L:
					if ((subset = getSubsetTag(parsed, testFn, L   ))) {
						break;
					}
				default:
					if (testFn('en')) {
						subset = 'en';
					}
					else {
						subset = null;
					}
			}

			if (subset == null) {
				failFn();
			} 
			else {
				successFn(subset);
			}
		}
	
		/**
		@name glow.i18n.setLocale
		@function
		@description Sets the locale to a new one, stacking up the old one for later retreival.
		
			Has no effect if the newLocaleTag is invalid.
		
		@param {String} newLocaleTag The new locale tag to be set.

		@returns this
		
		@example
			// assume locale is "en-GB" first
			glow.i18n.setLocale("cy-GB");
			// locale is now "cy-GB" with "en-GB" stacked up
		*/
		function setLocale( newLocaleTag ) {
			var old = currentLocale,
				parsed = parseTag(newLocaleTag);

			if (parsed) {
				currentLocale = parsed;
				currentLocale.next = old;
			}
			
			return self;
		}
	
		/**
		@name glow.i18n.revertLocale
		@function
		@description Reverts the locale to the one used immediately prior to the current one.
		
			Has no effect if the current locale was the first set (ie if no new locales have been set,
			or if the locale has been reverted all the way back to the beginning).

		@returns this
		
		@example
			// assume locale is "en-GB" first
			glow.i18n.setLocale("cy-GB");
			// locale is now "cy-GB" with "en-GB" stacked up
			glow.i18n.revertLocale();
			// locale is now back to "en-GB"
		*/
		function revertLocale() {
			currentLocale = currentLocale.next || currentLocale;
			
			return self;		
		}
		
		/**
		@name glow.i18n.getLocale
		@function
		@description Returns the tag of the current locale in canonical form.

		@returns {String}

		@example
			loc = glow.i18n.getLocale(); // returns the current locale eg "en-GB"

			glow.i18n.setLocale("cy-GB");
			loc = glow.i18n.getLocale(); // now returns "cy

			glow.i18n.setLocale("en-ignoredsubtag-US");
			loc = glow.i18n.getLocale(); // now returns "en-US", which is the canonical form
		*/
		function getLocale() {
			return currentLocale.canonical;
		}
		
		/**
		@name glow.i18n.addLocaleModule
		@function
		@description Stores the given data against the given module on the given locale.
			Creates any local packs and / or moduels that dio not already exist.
			Adds the given data to any that do.

		@param {String} moduleName The name of the module to be created/added to.
		@param {String} localeTag The locale tag to add the module to.
		@param {Object} data The data of the module in key : value form.

		@returns this
		
		@example
			// assume locale is "en-GB" first
			glow.i18n.setLocale("cy-nonsense-GB");
			var newLocale = glow.i18n.getLocale(); // returns "cy-GB"
		*/
		function addLocaleModule( moduleName, localeTag, data ) {
			var tag = parseTag(localeTag),
				pack,
				module,
				structure;
			
			if (tag) {
				pack      = localePacks[tag.canonical]  = localePacks[tag.canonical]  || {};
				module    = pack[moduleName]            = pack[moduleName]            || {};
				structure = moduleStructure[moduleName] = moduleStructure[moduleName] || {};
				
				for (var key in data) { // not using glow.lang.apply to avoid two loops
					module[key] = data[key];
					structure[key] = 1;
				}
			}
 			
			return self;
		}
	
		/**
		@name glow.i18n.getLocaleModule
		@function
		@description Retreives an object whose keys are every label that can have a value (via tag negotiation) associated with it, and whose values are the associated label values.

		@param {String} moduleName The name of the module retreived.
		@param {Object} [opts] Options object
			@param {String} [opts.locale] On override locale to use instaed of the system locale.

		@returns {Object}
		*/
		function getLocaleModule( moduleName, opts ) {
			var module = {},
				options = opts || {},
				structure = moduleStructure[moduleName] || {},
				localeTag = currentLocale,
				tag,
				label;

			// define the customisers for negotiate outside the loop
			// oddly, the loop control variable *is* correclty accessed, becasue of var scoping and the synchronous function calls
			function test( nTag ) {
				if (localePacks[nTag] && localePacks[nTag][moduleName] && localePacks[nTag][moduleName][label]) {
					return true;
				}
				else {
					return false;
				}
			}
			
			function success( sTag ) {
				module[label] = localePacks[sTag][moduleName][label];
			}
			
			function fail() {
				module[label] = "[Error! No " + moduleName + "." + label + " on " + localeTag.canonical + "]";
			}
			
			if (options.locale != undefined) {
				tag = parseTag(options.locale);
				
				if (tag) {
					localeTag = tag;
				}
			}

			for (label in structure) {
				negotiate(localeTag, test, success, fail);
			}

			return module;
		}
		
		/**
		@name glow.i18n.addLocalePack
		@function
		@description Shortcut for creating many locale modules on one locale (ie a brand new entire locale pack)

		@param {String} localeTag The name of the module retreived.
		@param {Object} data The data of the module in MODULE : key : value form.

		@returns this
		*/
		function addLocalePack( localeTag, data ) {
			for (var moduleName in data) {
				addLocaleModule(moduleName, localeTag, data[moduleName]);
			}
			
			return self;
		}
	
		/**
		@name glow.i18n.checkLocale
		@function
		@description Developer focused checker for getting the locale tag(s) returned by tag negotiation
			if no options passed it returns a structured data object of the entire data set for the given locale
			if just a module name is passed, the result set is limited to that module
			if a module name and a label are passed it returns a string for just that label
	
		@param {String} localeTag The name of the module retreived.
		@param {Object} [opts] Options object
			@param {String} [opts.module] If set, restricts the results to that module.
			@param {String} [opts.label] If set alongside opts.module, restricts the results to that label on that module.

		@returns {Object}
		*/
		function checkLocale( localeTag, opts ) {
			var options = opts || {},
				parsed = parseTag(localeTag);
	
			if (options.module) {
				if (options.label) {
					return checkLocaleByModuleAndLabel(parsed, options.module, options.label);
				}
				else {
					return checkLocaleByModule(parsed, options.module);
				}
			}
			else {
				return checkLocaleByEverything(parsed);
			}
			
			return null;
		}

		// helper for checkLocale
		function checkLocaleByModuleAndLabel( parsed, module, label ) {
			var result;
			
			// Define the customisers for negotiate outside the function call to be consistent with other checkLocaleBy* helpers
			function test( nTag ) {
				if (localePacks[nTag] && localePacks[nTag][module] && localePacks[nTag][module][label]) {
					return true;
				}
				else {
					return false;
				}
			}
			
			function success( sTag ) {
				result = sTag;
			}
			
			function fail() {
				result = "**error** - no negotiated value exists";
			}

			negotiate(parsed, test, success, fail);
			
			return result;
		}
		
		// helper for checkLocale
		function checkLocaleByModule( parsed, module ) {
			var structure = moduleStructure[module] || {},
				results = {},
				label;

			// Define the customisers for negotiate outside the loop
			// Oddly, the loop control variable *is* correclty accessed, becasue of var scoping and the synchronous function calls
			function test( nTag ) {
				if (localePacks[nTag] && localePacks[nTag][module] && localePacks[nTag][module][label]) {
					return true;
				}
				else {
					return false;
				}
			}
			
			function success( sTag ) {
				results[label] = sTag;
			}
			
			function fail() {
				results[label] = "**error** - no negotiated value exists";
			}
			
			for (label in structure) {
				negotiate(parsed, test, success, fail);
			}
			
			return results;			
		}
		
		// helper for checkLocale
		function checkLocaleByEverything( parsed ) {
			var results = {},
				module,
				label;
			
			// Define the customisers for negotiate outside the loop
			// Oddly, the loop control variable *is* correclty accessed, becasue of var scoping and the synchronous function calls
			function test( nTag ) {
				if (localePacks[nTag] && localePacks[nTag][module] && localePacks[nTag][module][label]) {
					return true;
				}
				else {
					return false;
				}
			}
			
			function success( sTag ) {
				results[module][label] = sTag;
			}
			
			function fail() {
				results[module][label] = "**error** - no negotiated value exists";
			}

			for (module in moduleStructure) {
				results[module] = {};
				
				for (label in moduleStructure[module]) {
					negotiate(parsed, test, success, fail);
				}
			}
			
			return results;
		}

		
		// make the module
		glow.i18n = self = {
			setLocale : setLocale,
			revertLocale : revertLocale,
			getLocale : getLocale,
			addLocaleModule : addLocaleModule,
			getLocaleModule : getLocaleModule,
			addLocalePack : addLocalePack,
			checkLocale : checkLocale
		}
		
		// define the basic 'en' locale pack
		// just the properties - widgets and modules will add their own locale modules
		addLocalePack("en", {
			PROPERTIES : {
				LANGUAGE : "English",
				DIR : "ltr"
			}
		});
	}
});

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

	About Locale Tags and Tag Negotiation
	=====================================
	
	Locale Tag negotiation is the process Glow uses to find the most specific
	match for a given tag given the context.
	
	
	
	Locale Tag Structure
	~~~~~~~~~~~~~~~~~~~~
	
	First, let's look at the anatomy of locale tags in Glow.
	
	According to the IANA spec, locale tags have this structure
	
		language-script-region-variant-extension-privateuse
	
	There are also "grandfathered" and "redundant" tags that existed before
	this structure was implemented and continue for backwards compatibility.
	
	Glow only supports the following subset of that structure. Subtags are
	separated by "-" and must appear in the correct order.
	
		language-script-region-variant
	
	These are the IANA formats of these subtags
	
	language : /[a-z]{2,3}/          - 2 or 3 lowercase letters.
	script   : /[A-Z][a-z]{3}/       - an uppercase letter followed by
									   3 lowercase letters
	region   : /[A-Z]{2}|[0-9]{3}/   - 2 upper case letters or a 3 digit number
	variant  : /[a-z0-9]{4,}/        - lower case letters or numbers,
									   4 or more characters
	
	eg (yes, these are all official IANA tags, even the last one...)
	
	en			  language                  generic English
	en-GB		  language-region        	British English
	en-Runr		  language-script           English written in Runic script
	en-Runr-GB	  language-script-region    British English written in Runic
	en-GB-scouse  language-region-variant	Scouse variant of British English
	
	While Glow does not support grandfathered or redundant tags or extension or
	private use subtags, it does not enforce compliance with the IANA registry.
	
	This means that if the subtag formats can be relaxed a little, variation
	from the standard could be used to fill these gaps with a tag that Glow can
	parse.
	
	As a result Glow applies theses formats to subtags
	
	language : /[a-z]{1,3}/        - 1, 2 or 3 lowercase letters
										> allowing shorter subtag than IANA
	script   : /[A-Z][a-z]{3}/     - an uppercase letter
									 followed by 3 lowercase letters
										> same as IANA
	region   : /[A-Z]{2}|[0-9]{3}/ - 2 upper case letters or a 3 digit number
										> same as IANA
	variant  : /[a-z0-9]{2,}/      - lower case letters or numbers,
									 2 or more characters
										> allowing shorter subtag than IANA
	
	This does mean that there is now potential conflict between the language
	and the variant subtags; a subtag that is 2 or 3 lowercase letters could be
	either. Glow's insistence on strict subtag order solves this. If a subtag
	that falls in this overlap zone is encountered, it is a language subtag
	first, a variant if a language has already be found, and ignored as a last
	resort.
	
	Now, even though according to IANA, en-GB-oed is grandfathered (the variant
	is too short), it can be directly supported by Glow.
	
	(If you're interested, en-GB-oed is British English, but with Oxford
	English Dictionary spellings. These basically -ize rather than -ise but all
	other spellings as en-GB, so the OED lists "colourize")
	
	
	
	Tag Negotiation Process
	~~~~~~~~~~~~~~~~~~~~~~~
	
	When parsing a tag, Glow will look for each subtag in the expected order.
	If a subtag is encountered out of order, or when that item has already been
	parsed, it will be ignored. If a subtag's type cannot be identified, it
	will be ignored.
	
	GB-cy-1-en-US will be parsed as cy-US.
		'GB' is out of order,
		'en' is a duplicated language subtag and
		'1' is not a recognised subtag type.
	
	Given all this, Locale negotiation occurs in the following order.
	
								script present?
									/      \
							 (yes) /        \ (no)
								  /          \
		language-script-region-variant    language-region-variant
				language-script-region    language-region
			   language-script-variant       /
					   language-script      /
									\      /
								language-variant
									language
									   en
	
	It starts at the specificity of the given tag, and skips steps which have a
	subtag that isn't present. eg
	
	xx-YY, which will be parsed as language-region, will negotiate as
		language-region
		language
		en
	
	xx-Yyyy-ZZ, will be parsed as language-script-region, and negotiate as
		language-script-region
		language-script
		language
		en
	
	When Locale packs are created, the tag will be checked to see if it can
	be negotiated. A valid tag must have at least a language, so "en-GB" and
	"cy" are valid, but "GB" is not.
	
	
	How this Module handles all this
	~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
	
	The code has a number of variables, objects and arrays whose names or
	values make reference to some variant or combination of l, s, r or v. These
	match to the 'L'anguage, 'S'cript, 'R'egion or 'V'ariant subtag.

	So, for instance, the variable LSRV is a bitmask for a tag structure with
	all four subtags.
	
	
	
	Useful URLs
	~~~~~~~~~~~
	
	http://www.w3.org/International/articles/language-tags/
	http://www.w3.org/International/articles/bcp47/
	http://www.iana.org/assignments/language-subtag-registry



 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */
/**
@name glow.dom
@namespace
@description Accessing and manipulating the DOM
@see <a href="../furtherinfo/creatingnodelists/">Creating NodeLists</a>
@see <a href="../furtherinfo/workingwithnodelists/">Working with NodeLists</a>
@see <a href="../furtherinfo/xmlnodelists/">XML NodeLists</a>
*/
(window.gloader || glow).module({
	name: "glow.dom",
	library: ["glow", "1.7.0"],
	depends: [],
	builder: function(glow) {
		//private
		var env = glow.env,
			lang = glow.lang,
		/*
		PrivateVar: cssRegex
			For matching CSS selectors
		*/
			cssRegex = {
				tagName: /^(\w+|\*)/,
				combinator: /^\s*([>]?)\s*/,
				//safari 1.3 is a bit dim when it comes to unicode stuff, only dot matches them (not even \S), so some negative lookalheads are needed
				classNameOrId: (env.webkit < 417) ? new RegExp("^([\\.#])((?:(?![\\.#\\[:\\s\\\\]).|\\\\.)+)") : /^([\.#])((?:[^\.#\[:\\\s]+|\\.)+)/
			},
			//for escaping strings in regex
			regexEscape = /([$^\\\/()|?+*\[\]{}.-])/g,

		/*
		PrivateVar: cssCache
			Cache of arrays representing an execution path for css selectors
		*/
			cssCache = {},

		/*
		PrivateVar: dom0PropertyMapping
			Mapping of HTML attribute names to DOM0 property names.
		*/
			dom0PropertyMapping = {
				checked    : "checked",
				"class"    : "className",
				"disabled" : "disabled",
				"for"      : "htmlFor",
				maxlength  : "maxLength"
			},

		/*
		PrivateVar: dom0BooleanAttribute
			The HTML attributes names that should be converted from true/false
			to ATTRIBUTENAME/undefined (i.e. boolean attributes like checked="checked").
		*/
			dom0BooleanAttribute = {
				checked  : true,
				disabled : true
			},

		/*
		PrivateVar: dom0AttributeMappings
			Functions that map dom0 values to sane ones.
		*/
			dom0AttributeMappings = {
				maxlength : function (val) { return val.toString() == "2147483647" ? undefined : val; }
			},
		/*
		PrivateVar: ucheck
			Used by unique(), increased by 1 on each use
		*/
			ucheck = 1,
		/*
		PrivateVar: ucheckPropName
			This is the property name used by unique checks
		*/
			ucheckPropName = "_unique" + glow.UID,
			
		/**
			@name glow.dom-dataPropName
			@private
			@type String
			@description The property name added to the DomElement by the NodeList#data method.
		*/
			dataPropName = "_uniqueData" + glow.UID,
		
		/**
			@name glow.dom-dataIndex
			@private
			@type String
			@description The value of the dataPropName added by the NodeList#data method.
		*/
			dataIndex = 1, // must be a truthy value
			
		/**
			@name glow.dom-dataCache
			@private
			@type Object
			@description Holds the data used by the NodeList#data method.
			
			The structure is like:
			[
				{
					myKey: "my data"
				}
			]
		*/
			dataCache = [],
		
		/*
		PrivateVar: htmlColorNames
			Mapping of colour names to hex values
		*/
			htmlColorNames = {
				black: 0,
				silver: 0xc0c0c0,
				gray: 0x808080,
				white: 0xffffff,
				maroon: 0x800000,
				red: 0xff0000,
				purple: 0x800080,
				fuchsia: 0xff00ff,
				green: 0x8000,
				lime: 0xff00,
				olive: 0x808000,
				yellow: 0xffff00,
				navy: 128,
				blue: 255,
				teal: 0x8080,
				aqua: 0xffff,
				orange: 0xffa500
			},
		/*
		PrivateVar: usesYAxis
			regex for detecting which css properties need to be calculated relative to the y axis
		*/
			usesYAxis = /height|top/,
			colorRegex = /^rgb\(([\d\.]+)(%?),\s*([\d\.]+)(%?),\s*([\d\.]+)(%?)/i,
			cssPropRegex = /^(?:(width|height)|(border-(top|bottom|left|right)-width))$/,
			hasUnits = /width|height|top$|bottom$|left$|right$|spacing$|indent$|font-size/,
			//append gets set to a function below
			append,
			//unique gets set to a function below
			unique,
			//we set this up at the end of the module
			placeholderElm,
			//getByTagName gets get to a function below
			getByTagName,
			win = window,
			doc = document,
			docBody,
			docElm,
			// true if properties of a dom node are cloned when the node is cloned (eg, true in IE)
			nodePropertiesCloned,
			// used to convert divs to strings
			tmpDiv = doc.createElement("div"),
			/*
			PrivateVars: tableArray, elmFilter
				Used in private function stringToNodes to capture any 
				elements that cannot be a childNode of <div>.
					Each entry in JSON responds to an element.
					First array value is how deep the element will be created in a node tree.
					Second array value is the beginning of the node tree.
					Third array value is the end of the node tree.
			*/
			tableArray = [1, '<table>', '</table>'],
			emptyArray = [0, '', ''],
			// webkit won't accept <link> elms to be the only child of an element,
			// it steals them and hides them in the head for some reason. Using
			// broken html fixes it for some reason
			paddingElmArray = env.webkit < 526 ? [0, '', '</div>', true] : [1, 'b<div>', '</div>'],
			trArray = [3, '<table><tbody><tr>', '</tr></tbody></table>'],
			elmWraps = {
				caption: tableArray,
				thead: tableArray,
				th: trArray,
				colgroup: tableArray,
				tbody: tableArray,
				tr: [2, '<table><tbody>', '</tbody></table>'],
				td: trArray,
				tfoot: tableArray,
				option: [1, '<select>', '</select>'],
				legend: [1, '<fieldset>', '</fieldset>'],
				link: paddingElmArray,
				script: paddingElmArray,
				style: paddingElmArray
			};
		
		// clean up IE's mess
		if (env.ie) {
			window.attachEvent("onunload", function() {
				tmpDiv = null;
			});
		}
		
		glow.ready(function() {
			docBody = doc.body;
			docElm = doc.documentElement;
		});
		
		
		// test for nodePropertiesCloned
		(function() {
			var div = doc.createElement("div");
			div.a = 1;
			nodePropertiesCloned = !!div.cloneNode(true).a;
		})();
		
		/**
		 @name glow.dom-getFirstChildElm
		 @private
		 @description Returns the first leaf of a NodeList
		 @param {NodeList} 
		*/
		function getFirstChildElm(parent) {					
			for (var child = parent.firstChild; child; child = child.nextSibling) {
				if (child.nodeType == 1) {
					return child;
				}			
			}			
			return null;			
		}

		/*
		PrivateMethod: removeClassRegex
			Get a regex that can be used to remove a class from a space separated list of classes.

		Arguments:
			name - (string) the name of the class.

		Returns:
			The regex.
		*/
		function removeClassRegex (name) {
			return new RegExp(["(^|\\s)", name.replace(regexEscape, "\\$1"), "($|\\s)"].join(""), "g");
		}


		/*
		PrivateMethod: stringToNodes
			Creates an array of nodes from a string
		*/
		function stringToNodes(str) {
			var r = [],
				tagName = (/^\s*<([^\s>]+)/.exec(str) || [,'div'])[1],
				// This matches str content with potential elements that cannot
				// be a child of <div>.  elmFilter declared at top of page.
				elmWrap = elmWraps[tagName] || emptyArray, 
				nodeDepth,
				childElm,
				rLen = 0;
			
			// Create the new element using the node tree contents available in filteredElm.
			tmpDiv.innerHTML = (elmWrap[1] + str + elmWrap[2]);
			
			childElm = tmpDiv;
			
			// Strip newElement down to just the required element and its parent
			nodeDepth = elmWrap[0];
			while(nodeDepth--) {
				childElm = childElm.lastChild;
			}

			// pull nodes out of child
			while (childElm.firstChild) {
				r[rLen++] = childElm.removeChild(childElm.firstChild);
			}
			
			childElm = null;
			
			return r;
		}

		/*
		PrivateMethod: nodelistToArray
			Converts a w3 NodeList to an array
		*/
		function nodelistToArray(nodelist) {
			var r = [], i = 0;
			for (; nodelist[i]; i++) {
				r[i] = nodelist[i];
			}
			return r;
		}

		/*
		PrivateMethod: setAttribute
			Sets the attribute in the nodelist using the supplied function.

		Arguments:
			value - (String|Function) the value/value generator.
			attributeSetter - (Function) a function that can be called to actually set the attribute.

		Returns:
			The <NodeList> object.
		*/
		// is marginal having this separated out as it is only used twice and call is almost as big
		// leaving it separate for now for once and only once, as well as in case attr does some more mutating stuff
		// could be merged back with attr later
		function setAttribute (value, attributeSetter) {
			for (var that = this, i = 0, length = that.length; i < length; i++) {
				attributeSetter.call(
					that[i],
					value.call ?
						value.call(that[i], i) :
						value
				);
			}
			return that;
		}


		/*
		PrivateMethod: append
			append the nodes in "b" to the array / list "a"
		*/
		//return different function for IE & Opera to deal with their stupid bloody expandos. Pah.
		if (document.all) {
			append = function(a, b) {
				var i = 0,
					ai = a.length,
					length = b.length;
				if (typeof b.length == "number") {
					for (; i < length; i++) {
						a[ai++] = b[i];
					}
				} else {
					for (; b[i]; i++) {
						a[ai++] = b[i];
					}
				}
			};
		} else {
			append = function(a, b) {
				var i = 0, ai = a.length;
				for (; b[i]; i++) {
					a[ai++] = b[i];
				}
			};
		}

		/*
		PrivateMethod: isXml
			Is this node an XML Document node or within an XML Document node

		Arguments:
			node

		Returns:
			Bool
		*/
		function isXml(node) {
			//test for nodes within xml element
			return  (node.ownerDocument && !node.ownerDocument.body) ||
					//test for xml document elements
					(node.documentElement && !node.documentElement.body);
		}

		/*
		PrivateMethod: unique
			Get an array of nodes without duplicate nodes from an array of nodes.

		Arguments:
			aNodes - (Array|<NodeList>)

		Returns:
			An array of nodes without duplicates.
		*/
		//worth checking if it's an XML document?
		if (env.ie) {
			unique = function(aNodes) {
				if (aNodes.length == 1) { return aNodes; }

				//remove duplicates
				var r = [],
					ri = 0,
					i = 0;

				for (; aNodes[i]; i++) {
					if (aNodes[i].getAttribute(ucheckPropName) != ucheck && aNodes[i].nodeType == 1) {
						r[ri++] = aNodes[i];
					}
					aNodes[i].setAttribute(ucheckPropName, ucheck);
				}
				for (i=0; aNodes[i]; i++) {
					aNodes[i].removeAttribute(ucheckPropName);
				}
				ucheck++;
				return r;
			}
		} else {
			unique = function(aNodes) {
				if (aNodes.length == 1) { return aNodes; }

				//remove duplicates
				var r = [],
					ri = 0,
					i = 0;

				for (; aNodes[i]; i++) {
					if (aNodes[i][ucheckPropName] != ucheck && aNodes[i].nodeType == 1) {
						r[ri++] = aNodes[i];
					}
					aNodes[i][ucheckPropName] = ucheck;
				}
				ucheck++;
				return r;
			}
		}

		/*
		PrivateMethod: getElementsByTag
			Get elements by a specified tag name from a set of context objects. If multiple
			context objects are passed, then the resulting array may contain duplicates. See
			<unique> to remove duplicate nodes.

		Arguments:
			tag - (string) Tag name. "*" for all.
			contexts - (array) DOM Documents and/or DOM Elements to search in.

		Returns:
			An array(like) collection of elements with the specified tag name.
		*/
		if (document.all) { //go the long way around for IE (and Opera)
			getByTagName = function(tag, context) {
				var r = [], i = 0;
				for (; context[i]; i++) {
					//need to check .all incase data is XML
					//TODO: Drop IE5.5
					if (tag == "*" && context[i].all && !isXml(context[i])) { // IE 5.5 doesn't support getElementsByTagName("*")
						append(r, context[i].all);
					} else {
						append(r, context[i].getElementsByTagName(tag));
					}
				}
				return r;
			};
		} else {
			getByTagName = function(tag, context) {
				var r = [], i = 0, len = context.length;
				for (; i < len; i++) {
					append(r, context[i].getElementsByTagName(tag));
				}
				return r;
			};
		}
		
		/*
			Get the child elements for an html node
		*/
		function getChildElms(node) {
			var r = [],
				childNodes = node.childNodes,
				i = 0,
				ri = 0;
			
			for (; childNodes[i]; i++) {
				if (childNodes[i].nodeType == 1 && childNodes[i].nodeName != "!") {
					r[ri++] = childNodes[i];
				}
			}
			return r;
		}
		
		
		var horizontalBorderPadding = [
				'border-left-width',
				'border-right-width',
				'padding-left',
				'padding-right'
			],
			verticalBorderPadding = [
				'border-top-width',
				'border-bottom-width',
				'padding-top',
				'padding-bottom'
			];
		
		/*
		PrivateMethod: getElmDimension
			Gets the size of an element as an integer, not including padding or border
		*/		
		function getElmDimension(elm, cssProp /* (width|height) */) {
			var r, // val to return
				docElmOrBody = env.standardsMode ? docElm : docBody,
				isWidth = (cssProp == "width"),
				cssPropCaps = isWidth ? "Width" : "Height",
				cssBorderPadding;

			if (elm.window) { // is window
				r = env.webkit < 522.11 ? (isWidth ? elm.innerWidth				: elm.innerHeight) :
					env.webkit			? (isWidth ? docBody.clientWidth		: elm.innerHeight) :
					env.opera < 9.5		? (isWidth ? docBody.clientWidth		: docBody.clientHeight) :
					/* else */			  (isWidth ? docElmOrBody.clientWidth	: docElmOrBody.clientHeight);

			}
			else if (elm.getElementById) { // is document
				// we previously checked offsetWidth & clientWidth here
				// but they returned values too large in IE6 scrollWidth seems enough
				r = Math.max(
					docBody["scroll" + cssPropCaps],
					docElm["scroll" + cssPropCaps]
				)
			}
			else {
				// get an array of css borders & padding
				cssBorderPadding = isWidth ? horizontalBorderPadding : verticalBorderPadding;
				r = elm['offset' + cssPropCaps] - parseInt( getCssValue(elm, cssBorderPadding) );
			}
			return r;
		}

		/*
		PrivateMethod: getBodyElm
			Gets the body elm for a given element. Gets around IE5.5 nonsense. do getBodyElm(elm).parentNode to get documentElement
		*/
		function getBodyElm(elm) {
			if (env.ie < 6) {
				return elm.document.body;
			} else {
				return elm.ownerDocument.body;
			}
		}

		/*
		PrivateMethod: setElmsSize
			Set element's size

		Arguments:
			elms - (<NodeList>) Elements
			val - (Mixed) Set element height / width. In px unless stated
			type - (String) "height" or "width"

		Returns:
			Nowt.
		*/
		function setElmsSize(elms, val, type) {
			if (typeof val == "number" || /\d$/.test(val)) {
				val += "px";
			}
			for (var i = 0, len = elms.length; i < len; i++) {
				elms[i].style[type] = val;
			}
		}

		/*
		PrivateMethod: toStyleProp
			Converts a css property name into its javascript name, such as "background-color" to "backgroundColor".

		Arguments:
			prop - (String) CSS Property name

		Returns:
			String, javascript style property name
		*/
		function toStyleProp(prop) {
			if (prop == "float") {
				return env.ie ? "styleFloat" : "cssFloat";
			}
			return lang.replace(prop, /-(\w)/g, function(match, p1) {
				return p1.toUpperCase();
			});
		}

		/*
		PrivateMethod: tempBlock
			Gives an element display:block (but keeps it hidden) and runs a function, then sets the element back how it was

		Arguments:
			elm - element
			func - function to run

		Returns:
			Return value of the function
		*/
		function tempBlock(elm, func) {
			//TODO: rather than recording individual style properties, just cache cssText? This was faster for getting the element size
			var r,
				elmStyle = elm.style,
				oldDisp = elmStyle.display,
				oldVis = elmStyle.visibility,
				oldPos = elmStyle.position;

			elmStyle.visibility = "hidden";
			elmStyle.position = "absolute";
			elmStyle.display = "block";
			if (!isVisible(elm)) {
				elmStyle.position = oldPos;
				r = tempBlock(elm.parentNode, func);
				elmStyle.display = oldDisp;
				elmStyle.visibility = oldVis;
			} else {
				r = func();
				elmStyle.display = oldDisp;
				elmStyle.position = oldPos;
				elmStyle.visibility = oldVis;
			}
			return r;
		}

		/*
		PrivateMethod: isVisible
			Is the element visible?
		*/
		function isVisible(elm) {
			//this is a bit of a guess, if there's a better way to do this I'm interested!
			return elm.offsetWidth ||
				elm.offsetHeight;
		}

		/*
		PrivateMethod: getCssValue
			Get a computed css property

		Arguments:
			elm - element
			prop - css property or array of properties to add together

		Returns:
			String, value
		*/
		function getCssValue(elm, prop) {
			var r, //return value
				total = 0,
				i = 0,
				propLen = prop.length,
				compStyle = doc.defaultView && (doc.defaultView.getComputedStyle(elm, null) || doc.defaultView.getComputedStyle),
				elmCurrentStyle = elm.currentStyle,
				oldDisplay,
				match,
				propTest = prop.push || cssPropRegex.exec(prop) || [];


			if (prop.push) { //multiple properties, add them up
				for (; i < propLen; i++) {
					total += parseInt( getCssValue(elm, prop[i]), 10 ) || 0;
				}
				return total + "px";
			}
			
			if (propTest[1]) { // is width / height
				if (!isVisible(elm)) { //element may be display: none
					return tempBlock(elm, function() {
						return getElmDimension(elm, propTest[1]) + "px";
					});
				}
				return getElmDimension(elm, propTest[1]) + "px";
			}
			else if (propTest[2] //is border-*-width
				&& glow.env.ie
				&& getCssValue(elm, "border-" + propTest[3] + "-style") == "none"
			) {
				return "0";
			}
			else if (compStyle) { //W3 Method
				//this returns computed values
				if (typeof compStyle == "function") {
					//safari returns null for compStyle when element is display:none

					oldDisplay = elm.style.display;
					r = tempBlock(elm, function() {
						if (prop == "display") { //get true value for display, since we've just fudged it
							elm.style.display = oldDisplay;
							if (!doc.defaultView.getComputedStyle(elm, null)) {
								return "none";
							}
							elm.style.display = "block";
						}
						return getCssValue(elm, prop);
					});
				} else {
					// assume equal horizontal margins in safari 3
					// http://bugs.webkit.org/show_bug.cgi?id=13343
					// The above bug doesn't appear to be closed, but it works fine in Safari 4
					if (env.webkit > 500 && env.webkit < 526 && prop == 'margin-right' && compStyle.getPropertyValue('position') != 'absolute') {
						prop = 'margin-left';
					}
					r = compStyle.getPropertyValue(prop);
				}
			} else if (elmCurrentStyle) { //IE method
				if (prop == "opacity") {
					match = /alpha\(opacity=([^\)]+)\)/.exec(elmCurrentStyle.filter);
					return match ? String(parseInt(match[1], 10) / 100) : "1";
				}
				//this returns cascaded values so needs fixing
				r = String(elmCurrentStyle[toStyleProp(prop)]);
				if (/^-?[\d\.]+(?!px)[%a-z]+$/i.test(r) && prop != "font-size") {
					r = getPixelValue(elm, r, usesYAxis.test(prop)) + "px";
				}
			}
			//some results need post processing
			if (prop.indexOf("color") != -1) { //deal with colour values
				r = normaliseCssColor(r).toString();
			} else if (r.indexOf("url") == 0) { //some browsers put quotes around the url, get rid
				r = r.replace(/\"/g,"");
			}
			return r;
		}

		/*
		PrivateMethod: getPixelValue
			Converts a relative value into an absolute pixel value. Only works in IE with Dimension value (not stuff like relative font-size).
			Based on some Dean Edwards' code

		Arguments:
			element - element used to calculate relative values
			value - (string) relative value
			useYAxis - (string) calulate relative values to the y axis rather than x

		Returns:
			Number
		*/
		function getPixelValue(element, value, useYAxis) {
			// Remember the original values
			var axisPos = useYAxis ? "top" : "left",
				axisPosUpper = useYAxis ? "Top" : "Left",
				elmStyle = element.style,
				positionVal = elmStyle[axisPos],
				runtimePositionVal = element.runtimeStyle[axisPos],
				r;
			
			// copy to the runtime type to prevent changes to the display
			element.runtimeStyle[axisPos] = element.currentStyle[axisPos];
			// set value to left / top
			elmStyle[axisPos] = value;
			// get the pixel value
			r = elmStyle["pixel" + axisPosUpper];
			
			// revert values
			elmStyle[axisPos] = positionVal;
			element.runtimeStyle[axisPos] = runtimePositionVal;
			
			return r;
		}

		/*
		PrivateMethod: normaliseCssColor
			Converts a CSS colour into "rgb(255, 255, 255)" or "transparent" format
		*/

		function normaliseCssColor(val) {
			if (/^(transparent|rgba\(0, ?0, ?0, ?0\))$/.test(val)) { return 'transparent'; }
			var match, //tmp regex match holder
				r, g, b, //final colour vals
				hex, //tmp hex holder
				mathRound = Math.round,
				parseIntFunc = parseInt,
				parseFloatFunc = parseFloat;

			if (match = colorRegex.exec(val)) { //rgb() format, cater for percentages
				r = match[2] ? mathRound(((parseFloatFunc(match[1]) / 100) * 255)) : parseIntFunc(match[1]);
				g = match[4] ? mathRound(((parseFloatFunc(match[3]) / 100) * 255)) : parseIntFunc(match[3]);
				b = match[6] ? mathRound(((parseFloatFunc(match[5]) / 100) * 255)) : parseIntFunc(match[5]);
			} else {
				if (typeof val == "number") {
					hex = val;
				} else if (val.charAt(0) == "#") {
					if (val.length == "4") { //deal with #fff shortcut
						val = "#" + val.charAt(1) + val.charAt(1) + val.charAt(2) + val.charAt(2) + val.charAt(3) + val.charAt(3);
					}
					hex = parseIntFunc(val.slice(1), 16);
				} else {
					hex = htmlColorNames[val];
				}

				r = (hex) >> 16;
				g = (hex & 0x00ff00) >> 8;
				b = (hex & 0x0000ff);
			}

			val = new String("rgb(" + r + ", " + g + ", " + b + ")");
			val.r = r;
			val.g = g;
			val.b = b;
			return val;
		}

		/*
		PrivateMethod: getTextNodeConcat
			Take an element and returns a string of its text nodes combined. This is useful when a browser (Safari 2) goes mad and doesn't return anything for innerText or textContent
		*/
		function getTextNodeConcat(elm) {
			var r = "",
				nodes = elm.childNodes,
				i = 0,
				len = nodes.length;
			for (; i < len; i++) {
				if (nodes[i].nodeType == 3) { //text
					//this function is used in safari only, string concatination is faster
					r += nodes[i].nodeValue;
				} else if (nodes[i].nodeType == 1) { //element
					r += getTextNodeConcat(nodes[i]);
				}
			}
			return r;
		}

		/*
		PrivateMethod: getNextOrPrev
			This gets the next / previous sibling element of each node in a nodeset
			and returns the new nodeset.
		*/
		function getNextOrPrev(nodelist, dir /* "next" or "previous" */) {
			var ret = [],
				ri = 0,
				nextTmp,
				i = 0,
				length = nodelist.length;

			for (; i < length; i++) {
				nextTmp = nodelist[i];
				while (nextTmp = nextTmp[dir + "Sibling"]) {
					if (nextTmp.nodeType == 1 && nextTmp.nodeName != "!") {
						ret[ri++] = nextTmp;
						break;
					}
				}
			}
			return r.get(ret);
		}
		
		/*
		 Get the 'real' positioned parent for an element, otherwise return null.
		*/
		function getPositionedParent(elm) {
			var offsetParent = elm.offsetParent;
			
			// get the real positioned parent
			// IE places elements with hasLayout in the offsetParent chain even if they're position:static
			// Also, <body> and <html> can appear in the offsetParent chain, but we don't want to return them if they're position:static
			while (offsetParent && r.get(offsetParent).css("position") == "static") {	
				offsetParent = offsetParent.offsetParent;
			}
			
			// sometimes the <html> element doesn't appear in the offsetParent chain, even if it has position:relative
			if (!offsetParent && r.get(docElm).css("position") != "static") {
				offsetParent = docElm;
			}
			
			return offsetParent || null;
		}
		
		/**
		 @name glow.dom-getScrollOffset
		 @private
		 @description Get the scrollTop / scrollLeft of a particular element
		 @param {Element} elm Element (or window object) to get the scroll position of
		 @param {Boolean} isLeft True if we're dealing with left scrolling, otherwise top
		*/
		function getScrollOffset(elm, isLeft) {
			var r,			
				scrollProp = 'scroll' + (isLeft ? "Left" : "Top");
			
			// are we dealing with the window object or the document object?
			if (elm.window) {
				// get the scroll of the documentElement or the pageX/Yoffset
				// - some browsers use one but not the other
				r = elm.document.documentElement[scrollProp]
					|| (isLeft ? elm.pageXOffset : elm.pageYOffset)
					|| 0;
			}
			else {
				r = elm[scrollProp];
			}
			return r;
		}
		
		/**
		 @name glow.dom-setScrollOffset
		 @private
		 @description Set the scrollTop / scrollLeft of a particular element
		 @param {Element} elm Element (or window object) to get the scroll position of
		 @param {Boolean} isLeft True if we're dealing with left scrolling, otherwise top
		 @param {Number} newVal New scroll value
		*/
		function setScrollOffset(elm, isLeft, newVal) {
			
			// are we dealing with the window object or the document object?
			if (elm.window) {
				// we need to get whichever value we're not setting
				elm.scrollTo(
					isLeft  ? newVal : getScrollOffset(elm, true),
					!isLeft ? newVal : getScrollOffset(elm, false)
				);
			}
			else {
				elm['scroll' + (isLeft ? "Left" : "Top")] = newVal;
			}
		}
		
		/**
		 @name glow.dom-scrollOffset
		 @private
		 @description Set/get the scrollTop / scrollLeft of a NodeList
		 @param {glow.dom.NodeList} nodeList Elements to get / set the position of
		 @param {Boolean} isLeft True if we're dealing with left scrolling, otherwise top
		 @param {Number} [val] Val to set (if not provided, we'll get the value)
		 
		 @returns NodeList for sets, Number for gets
		*/
		function scrollOffset(nodeList, isLeft, val) {
			var i = nodeList.length;
			
			if (val !== undefined) {
				while (i--) {
					setScrollOffset(nodeList[i], isLeft, val);
				}
				return nodeList;
			} else {
				return getScrollOffset(nodeList[0], isLeft);
			}
		}

		//public
		var r = {}; //object to be returned

		/**
		@name glow.dom.get
		@function
		@description Returns a {@link glow.dom.NodeList NodeList} from CSS selectors and/or Elements.

		@param {String | String[] | Element | Element[] | glow.dom.NodeList} nodespec+ One or more CSS selector strings, Elements or {@link glow.dom.NodeList NodeLists}.

			Will also accept arrays of these types, or any combinations thereof.

			Supported CSS selectors:

			<ul>
				<li>Universal selector "*".</li>
				<li>Type selector "div"</li>
				<li>Class selector ".myClass"</li>
				<li>ID selector "#myDiv"</li>
				<li>Child selector "ul > li"</li>
				<li>Grouping "div, p"</li>
			</ul>

		@returns {glow.dom.NodeList}

		@example
			// Nodelist with all links in element with id "nav"
			var myNodeList = glow.dom.get("#nav a");

		@example
			// NodeList containing the nodes passed in
			var myNodeList = glow.dom.get(someNode, anotherNode);

		@example
			// NodeList containing elements in the first form
			var myNodeList = glow.dom.get(document.forms[0].elements);
		*/
		r.get = function() {
			var r = new glow.dom.NodeList(),
				i = 0,
				args = arguments,
				argsLen = args.length;

			for (; i < argsLen; i++) {
				if (typeof args[i] == "string") {
					r.push(new glow.dom.NodeList().push(doc).get(args[i]));
				} else {
					r.push(args[i]);
				}
			}
			return r;
		};

		/**
		@name glow.dom.create
		@function
		@description Returns a {@link glow.dom.NodeList NodeList} from an HTML fragment.

		@param {String} html An HTML string.

			All top-level nodes must be elements (i.e. text content in the
			HTML must be wrapped in HTML tags).

		@param {Object} [opts] An optional options object
			@param {Object} [opts.interpolate] Data for a call to {@link glow.lang.interpolate}
				If this option is set, the String html parameter will be passed through glow.lang.interpolate with this as the data and no options
				If glow.lang.interpolates options are required, an explicit call must be made
			@param {Boolean} [opts.escapeHtml] Escape HTML in the interpolate data object.
				See {@link glow.lang.interpolate}

		@returns {glow.dom.NodeList}

		@example
			// NodeList of two elements
			var myNodeList = glow.dom.create("<div>Hello</div><div>World</div>");
			
		@example
			// Nodelist of one list item
			var listItem = glow.dom.create('<li>{content}</li>', {
				interpolate: {content: textFromUser},
				escapeHtml: true
			});
			// if testFromUser contains HTML, it will be correctly escaped
			// before being inserted into the li
		*/
		r.create = function(sHtml, opts) {
			var ret = [],
				i = 0,
				rLen = 0,
				toCheck;
			
			// set default options
			opts = glow.lang.apply({
				interpolate: null,
				escapeHtml: false
			}, opts || {});
			
			if (opts.interpolate) {
				sHtml = lang.interpolate(sHtml, opts.interpolate, {
					escapeHtml: opts.escapeHtml
				});
			}
			
			toCheck = stringToNodes(sHtml);
			
			for (; toCheck[i]; i++) {
				if (toCheck[i].nodeType == 1 && toCheck[i].nodeName != "!") {
					ret[rLen++] = toCheck[i];
				} else if (toCheck[i].nodeType == 3 && lang.trim(toCheck[i].nodeValue) !== "") {
					throw new Error("glow.dom.create - Text must be wrapped in an element");
				}
			}
			return new r.NodeList().push(ret);
		};

		/**
		@name glow.dom.parseCssColor
		@function
		@description Returns an object representing a CSS colour string.

		@param {String} color A CSS colour.

			Examples of valid values are "red", "#f00", "#ff0000",
			"rgb(255,0,0)", "rgb(100%, 0%, 0%)"

		@returns {Object}

			An object with properties named "r", "g" and "b", each will have
			an integer value between 0 and 255.

		@example
			glow.dom.parseCssColor("#ff0000");
			// returns {r:255, g:0, b:0}
		*/
		r.parseCssColor = function(cssColor) {
			var normal = normaliseCssColor(cssColor);
			return {r: normal.r, g: normal.g, b: normal.b};
		}

		/**
		@name glow.dom.NodeList
		@class
		@description An array-like collection of DOM Elements.

			It is recommended you create a NodeList using {@link glow.dom.get glow.dom.get},
			or {@link glow.dom.create glow.dom.create}, but you can also use
			the constructor to create an empty NodeList.

			Unless otherwise specified, all methods of NodeList return the
			NodeList itself, allowing you to chain methods calls together.

		@example
			// empty NodeList
			var nodes = new glow.dom.NodeList();

		@example
			// using get to return a NodeList then chaining methods
			glow.dom.get("p").addClass("eg").append("<b>Hello!</b>");

		@see <a href="../furtherinfo/creatingnodelists/">Creating NodeLists</a>
		@see <a href="../furtherinfo/workingwithnodelists/">Working with NodeLists</a>
		@see <a href="../furtherinfo/xmlnodelists/">XML NodeLists</a>
		*/
		r.NodeList = function() {

			/**
			@name glow.dom.NodeList#length
			@type Number
			@description Number of nodes in the NodeList
			@example
				// get the number of paragraphs on the page
				glow.dom.get("p").length;
			*/
			this.length = 0; //number of elements in NodeList
		};

		/*
			Group: Methods
		*/
		r.NodeList.prototype = {

			/**
			@name glow.dom.NodeList#item
			@function
			@description Returns a node from the NodeList.

			@param {Number} index The numeric index of the node to return.

			@returns {Element}

			@example
				// get the fourth node
				var node = myNodeList.item(3);

			@example
				// another way to get the fourth node
				var node = myNodeList[3];
			*/
			item: function (nIndex) {
				return this[nIndex];
			},

			/**
			@name glow.dom.NodeList#push
			@function
			@description Adds Elements to the NodeList.

			@param {Element | Element[] | glow.dom.NodeList} nodespec+ One or more Elements, Arrays of Elements or NodeLists.

			@returns {glow.dom.NodeList}

			@example
				var myNodeList = glow.dom.create("<div>Hello world</div>");
				myNodeList.push("<div>Foo</div>", glow.dom.get("#myList li"));
			*/
			push: function() {
				var args = arguments,
					argsLen = args.length,
					i = 0,
					n,
					nNodeListLength,
					that = this,
					arrayPush = Array.prototype.push;

				for (; i < argsLen; i++) {
					if (!args[i]) {
						continue;
					} else if (args[i].nodeType == 1 || args[i].nodeType == 9 || args[i].document) { //is Node
						arrayPush.call(that, args[i]);
					} else if (args[i][0]) { //is array or array like
						for (n = 0, nNodeListLength = args[i].length; n < nNodeListLength; n++) {
							arrayPush.call(that, args[i][n]);
						}
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#each
			@function
			@description Calls a function for each node.

				The supplied function will be called for each node in the NodeList.
				
				The index of the node will be provided as the first parameter, and
				'this' will refer to the node.

			@param {Function} callback The function to run for each node.

			@returns {glow.dom.NodeList}

			@example
				var myNodeList = glow.dom.get("a");
				myNodeList.each(function(i){
					// in this function: this == myNodeList[i]
				});
			*/
			each: function (callback) {
				for (var i = 0, that = this, length = that.length; i < length; i++) {
					callback.call(that[i], i, that);
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#eq
			@function
			@description Compares the NodeList to an element, array of elements or another NodeList

					Returns true if the items are the same and are in the same
					order.

			@param {Element | Element[] | glow.dom.NodeList} nodespec The element, array or NodeList the NodeList is being compared to.

			@returns {Boolean}

			@example
				// the following returns true
				glow.dom.get('#blah').eq( document.getElementById('blah') );
			*/
			eq: function (nodelist) {
				var that = this, i = 0, length = that.length;

				if (! nodelist.push) { nodelist = [nodelist]; }
				if (nodelist.length != that.length) { return false; }
				for (; i < length; i++) {
					if (that[i] != nodelist[i]) { return false; }
				}
				return true;
			},

			/**
			@name glow.dom.NodeList#isWithin
			@function
			@description Tests if all the nodes are decendents of an element.

			@param {Element | glow.dom.NodeList} nodespec The element or NodeList that the NodeList is being tested against.

				If nodespec is a NodeList, then the its first node will be used.

			@returns {glow.dom.NodeList}

			@example
				var myNodeList = glow.dom.get("input");
				if (myNodeList.isWithin(glow.dom.get("form")) {
					// do something
				}
			*/
			isWithin: function (node) {
				if (node.push) { node = node[0]; }
				
				// missing some nodes? Return false
				if ( !node || !this.length ) { return false; }
				
				var that = this,
					i = 0,
					length = that.length,
					toTest; //node to test in manual method

				if (node.contains && env.webkit >= 521) { //proprietary method, safari 2 has a wonky implementation of this, avoid, avoid, avoid
					//loop through
					for (; i < length; i++) {
						// myNode.contains(myNode) returns true in most browsers
						if (!(node.contains(that[i]) && that[i] != node)) { return false; }
					}
				} else if (that[0].compareDocumentPosition) { //w3 method
					//loop through
					for (; i < length; i++) {
						//compare against bitmask
						if (!(that[i].compareDocumentPosition(node) & 8)) { return false; }
					}
				} else { //manual method
					for (; i < length; i++) {
						toTest = that[i];
						while (toTest = toTest.parentNode) {
							if (toTest == node) { break; }
						}
						if (!toTest) { return false; }
					}
				}
				return true;
			},

			/**
			@name glow.dom.NodeList#attr
			@function
			@description Gets or sets attributes

				When getting an attribute, it is retrieved from the first
				node in the NodeList. Setting attributes applies the change
				to each element in the NodeList.

				To set an attribute, pass in the name as the first
				parameter and the value as a second parameter.

				To set multiple attributes in one call, pass in an object of
				name/value pairs as a single parameter.

				For browsers that don't support manipulating attributes
				using the DOM, this method will try to do the right thing
				(i.e. don't expect the semantics of this method to be
				consistent across browsers as this is not possible with
				currently supported browsers).

			@param {String | Object} name The name of the attribute, or an object of name/value pairs
			@param {String} [value] The value to set the attribute to.

			@returns {String | glow.dom.NodeList}

				When setting attributes it returns the NodeList, otherwise
				returns the attribute value.

			@example
				var myNodeList = glow.dom.get(".myImgClass");

				// get an attribute
				myNodeList.attr("class");

				// set an attribute
				myNodeList.attr("class", "anotherImgClass");

				// set multiple attributes
				myNodeList.attr({
				  src: "a.png",
				  alt: "Cat jumping through a field"
				});
			*/
			attr: function (name /* , val */) {
				var that = this,
					args = arguments,
					argsLen = args.length,
					i,
					value;

				if (that.length === 0) {
					return argsLen > 1 ? that : undefined;
				}
				if (typeof name == 'object') {
					for (i in name) {
						if (lang.hasOwnProperty(name, i)) {
							that.attr(i, name[i]);
						}
					}
					return that;
				}
				if (env.ie && dom0PropertyMapping[name]) {
					if (argsLen > 1) {
						setAttribute.call(
							that,
							args[1],
							// in the callback this is the dom node
							function (val) { this[dom0PropertyMapping[name]] = val; }
						);
						return that;
					}
					value = that[0][dom0PropertyMapping[name]];
					if (dom0BooleanAttribute[name]) {
						return value ? name : undefined;
					}
					else if (dom0AttributeMappings[name]) {
						return dom0AttributeMappings[name](value);
					}
					return value;
				}
				if (argsLen > 1) {
					setAttribute.call(
						that,
						args[1],
						// in the callback this is the dom node
						function (val) { this.setAttribute(name, val); }
					);
					return that;
				}
				//2nd parameter makes IE behave, but errors for XML nodes (and isn't needed for xml nodes)
				return isXml(that[0]) ? that[0].getAttribute(name) : that[0].getAttribute(name, 2);
			},

			/**
			@name glow.dom.NodeList#removeAttr
			@function
			@description Removes an attribute from each node.

			@param {String} name The name of the attribute to remove.

			@returns {glow.dom.NodeList}

			@example
				glow.dom.get("a").removeAttr("target");
			*/
			removeAttr: function (name) {
				var mapping = env.ie && dom0PropertyMapping[name],
					that = this,
					i = 0,
					length = that.length;

				for (; i < length; i++) {
					if (mapping) {
						that[i][mapping] = "";
					} else {
						that[i].removeAttribute(name);
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#hasAttr
			@function
			@description Does the node have a particular attribute?
				
				The first node in the NodeList is tested
				
			@param {String} name The name of the attribute to test for.

			@returns {Boolean}

			@example
				if ( glow.dom.get("#myImg").hasAttr("alt") ){
					// ...
				}
			*/
			hasAttr: function (name) {
				var firstNode = this[0],
					attributes = firstNode.attributes;

				if (isXml(firstNode) && env.ie) { //getAttributeNode not supported for XML
					var attributes = firstNode.attributes,
						i = 0,
						len = attributes.length;

					//named node map doesn't seem to work properly, so need to go by index
					for (; i < len; i++) {
						if (attributes[i].nodeName == name) {
							return attributes[i].specified;
						}
					}
					return false;
				} else if (this[0].getAttributeNode) {
					var attr = this[0].getAttributeNode(name);
					return attr ? attr.specified : false;
				}

				return typeof attributes[attr] != "undefined";
			},
			
			/**
			@name glow.dom.NodeList#prop
			@function
			@description Gets or sets node peropties
			
				This function gets / sets node properties, to get attributes,
				see {@link glow.dom.NodeList#attr NodeList#attr}.
				
				When getting a property, it is retrieved from the first
				node in the NodeList. Setting properties to each element in
				the NodeList.
				
				To set multiple properties in one call, pass in an object of
				name/value pairs.
				
			@param {String | Object} name The name of the property, or an object of name/value pairs
			@param {String} [value] The value to set the property to.

			@returns {String | glow.dom.NodeList}

				When setting properties it returns the NodeList, otherwise
				returns the property value.

			@example
				var myNodeList = glow.dom.get("#formElement");

				// get the node name
				myNodeList.prop("nodeName");

				// set a property
				myNodeList.prop("_secretValue", 10);

				// set multiple properties
				myNodeList.prop({
					checked: true,
					_secretValue: 10
				});
			*/
			prop: function(name, val) {
				
				// setting multiple
				if (name.constructor === Object) {
					var hash = name,
						key;
					
					// loop through hash
					for (key in hash) {
						this.prop(key, hash[key]);
					}
					return this;
				}
				
				// setting single (to all in the NodeList)
				if (val !== undefined) {
					var i = this.length;
					while (i--) {
						this[i][name] = val;
					}
					return this;
				}
				
				// getting
				if (!this[0]) { return undefined; }
				return this[0][name];
			},
			
			/**
			@name glow.dom.NodeList#hasClass
			@function
			@description Tests if a node has a given class.

				Will return true if any node in the NodeList has the supplied class

				<p><em>This method is not applicable to XML NodeLists.</em></p>

			@param {String} name The name of the class to test for.

			@returns {Boolean}

			@example
				if (glow.dom.get("a").hasClass("termsLink")){
					// ...
				}
			*/
			hasClass: function (name) {
				for (var i = 0, length = this.length; i < length; i++) {
					if ((" " + this[i].className + " ").indexOf(" " + name + " ") != -1) {
						return true;
					}
				}
				return false;
			},

			/**
			@name glow.dom.NodeList#addClass
			@function
			@description Adds a class to each node.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

			@param {String} name The name of the class to add.

			@returns {glow.dom.NodeList}

			@example
				glow.dom.get("#login a").addClass("highlight");
			*/
			addClass: function (name) {
				for (var i = 0, length = this.length; i < length; i++) {
					if ((" " + this[i].className + " ").indexOf(" " + name + " ") == -1) {
						this[i].className += ((this[i].className)? " " : "") + name;
					}
				}
				return this;
			},

			/**
			@name glow.dom.NodeList#removeClass
			@function
			@description Removes a class from each node.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

			@param {String} name The name of the class to remove.

			@returns {glow.dom.NodeList}

			@example
				glow.dom.get("#footer #login a").removeClass("highlight");
			*/
			removeClass: function (name) {
				var re = removeClassRegex(name),
					that = this,
					i = 0,
					length = that.length;

				for (; i < length; i++) {
					that[i].className = that[i].className.replace(re, " ");
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#toggleClass
			@function
			@description Toggles a class on each node.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

			@param {String} name The name of the class to toggle.

			@returns {glow.dom.NodeList}

			@example
				glow.dom.get(".onOffSwitch").toggleClass("on");
			 */
			toggleClass: function (name) {
				var i = this.length,
					paddedClassName,
					paddedName = " " + name + " ";
					
				while (i--) {
					paddedClassName = " " + this[i].className + " ";
					
					if (paddedClassName.indexOf(paddedName) != -1) {
						this[i].className = paddedClassName.replace(paddedName, " ");
					} else {
						this[i].className += " " + name;
					}
				}
				return this;
			},

			/**
			@name glow.dom.NodeList#val
			@function
			@description Gets or sets form values for the first node.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

				<p><em>Getting values from form elements</em></p>

				The returned value depends on the type of element, see below:

				<dl>
				<dt>Radio button or checkbox</dt>
				<dd>If checked, then the contents of the value attribute, otherwise an empty string.</dd>
				<dt>Select</dt>
				<dd>The contents of value attribute of the selected option</dd>
				<dt>Select (multiple)</dt>
				<dd>An array of selected option values.</dd>
				<dt>Other form element</dt>
				<dd>The value of the input.</dd>
				</dl>

				<p><em>Getting values from a form</em></p>

				If the first element in the NodeList is a form, then an
				object is returned containing the form data. Each item
				property of the object is a value as above, apart from when
				multiple elements of the same name exist, in which case the
				it will contain an array of values.

				<p><em>Setting values for form elements</em></p>

				If a value is passed and the first element of the NodeList
				is a form element, then the form element is given that value.
				For select elements, this means that the first option that
				matches the value will be selected. For selects that allow
				multiple selection, the options which have a value that
				exists in the array of values/match the value will be
				selected and others will be deselected.

				Currently checkboxes and radio buttons are not checked or
				unchecked, just their value is changed. This does mean that
				this does not do exactly the reverse of getting the value
				from the element (see above) and as such may be subject to
				change

				<p><em>Setting values for forms</em></p>

				If the first element in the NodeList is a form and the
				value is an object, then each element of the form has its
				value set to the corresponding property of the object, using
				the method described above.

			@param {String | Object} [value] The value to set the form element/elements to.

			@returns {glow.dom.NodeList | String | Object}

				When used to set a value it returns the NodeList, otherwise
				returns the value as described above.

			@example
				// get a value
				var username = glow.dom.get("input#username").val();

			@example
				// get values from a form
				var userDetails = glow.dom.get("form").val();

			@example
				// set a value
				glow.dom.get("input#username").val("example username");

			@example
				// set values in a form
				glow.dom.get("form").val({
					username : "another",
					name     : "A N Other"
				});
			*/
			val: function () {

				/*
				PrivateFunction: elementValue
					Get a value for a form element.
				*/
				function elementValue (el) {
					var elType = el.type,
						elChecked = el.checked,
						elValue = el.value,
						vals = [],
						i = 0;

					if (elType == "radio") {
						return elChecked ? elValue : "";
					} else if (elType == "checkbox") {
						return elChecked ? elValue : "";

					} else if (elType == "select-one") {
						return el.selectedIndex > -1 ?
							el.options[el.selectedIndex].value : "";

					} else if (elType == "select-multiple") {
						for (var length = el.options.length; i < length; i++) {
							if (el.options[i].selected) {
								vals[vals.length] = el.options[i].value;
							}
						}
						return vals;
					} else {
						return elValue;
					}
				}

				/*
				PrivateMethod: formValues
					Get an object containing form data.
				*/
				function formValues (form) {
					var vals = {},
						radios = {},
						formElements = form.elements,
						i = 0,
						length = formElements.length,
						name,
						formElement,
						j,
						radio,
						nodeName;

					for (; i < length; i++) {
						formElement = formElements[i];
						nodeName = formElement.nodeName.toLowerCase();
						name = formElement.name;
						
						// fieldsets & objects come back as form elements, but we don't care about these
						// we don't bother with fields that don't have a name
						// switch to whitelist?
						if (
							nodeName == "fieldset" ||
							nodeName == "object" ||
							!name
						) { continue; }

						if (formElement.type == "checkbox" && ! formElement.checked) {
							if (! name in vals) {
								vals[name] = undefined;
							}
						} else if (formElement.type == "radio") {
							if (radios[name]) {
								radios[name][radios[name].length] = formElement;
							} else {
								radios[name] = [formElement];
							}
						} else {
							var value = elementValue(formElement);
							if (name in vals) {
								if (vals[name].push) {
									vals[name][vals[name].length] = value;
								} else {
									vals[name] = [vals[name], value];
								}
							} else {
								vals[name] = value;
							}
						}
					}
					for (i in radios) {
						j = 0;
						for (length = radios[i].length; j < length; j++) {
							radio = radios[i][j];
							name = radio.name;
							if (radio.checked) {
								vals[radio.name] = radio.value;
								break;
							}
						}
						if (! name in vals) { vals[name] = undefined; }
					}
					return vals;
				}

				/*
				PrivateFunction: setFormValues
					Set values of a form to those in passed in object.
				*/
				function setFormValues (form, vals) {
					var prop, currentField,
						fields = {},
						storeType, i = 0, n, len, foundOne, currentFieldType;

					for (prop in vals) {
						currentField = form[prop];
						if (currentField && currentField[0] && !currentField.options) { // is array of fields
							//normalise values to array of vals
							vals[prop] = vals[prop] && vals[prop].push ? vals[prop] : [vals[prop]];
							//order the fields by types that matter
							fields.radios = [];
							fields.checkboxesSelects = [];
							fields.multiSelects = [];
							fields.other = [];

							for (i = 0; currentField[i]; i++) {
								currentFieldType = currentField[i].type;
								if (currentFieldType == "radio") {
									storeType = "radios";
								} else if (currentFieldType == "select-one" || currentFieldType == "checkbox") {
									storeType = "checkboxesSelects";
								} else if (currentFieldType == "select-multiple") {
									storeType = "multiSelects";
								} else {
									storeType = "other";
								}
								//add it to the correct array
								fields[storeType][fields[storeType].length] = currentField[i];
							}

							for (i = 0; fields.multiSelects[i]; i++) {
								vals[prop] = setValue(fields.multiSelects[i], vals[prop]);
							}
							for (i = 0; fields.checkboxesSelects[i]; i++) {
								setValue(fields.checkboxesSelects[i], "");
								for (n = 0, len = vals[prop].length; n < len; n++) {
									if (setValue(fields.checkboxesSelects[i], vals[prop][n])) {
										vals[prop].slice(n, 1);
										break;
									}
								}
							}
							for (i = 0; fields.radios[i]; i++) {
								fields.radios[i].checked = false;
								foundOne = false;
								for (n = 0, len = vals[prop].length; n < len; n++) {
									if (setValue(fields.radios[i], vals[prop][n])) {
										vals[prop].slice(n, 1);
										foundOne = true;
										break;
									}
									if (foundOne) { break; }
								}
							}
							for (i = 0; fields.other[i] && vals[prop][i] !== undefined; i++) {
								setValue(fields.other[i], vals[prop][i]);
							}
						} else if (currentField && currentField.nodeName) { // is single field, easy
							setValue(currentField, vals[prop]);
						}
					}
				}

				/*
				PrivateFunction: setValue
					Set the value of a form element.

				Returns:
					values that weren't able to set if array of vals passed (for multi select). Otherwise true if val set, false if not
				*/
				function setValue (el, val) {
					var i = 0,
						length,
						n = 0,
						nlen,
						elOption,
						optionVal;

					if (el.type == "select-one") {
						for (length = el.options.length; i < length; i++) {
							if (el.options[i].value == val) {
								el.selectedIndex = i;
								return true;
							}
						}
						return false;
					} else if (el.type == "select-multiple") {
						var isArray = !!val.push;
						for (i = 0, length = el.options.length; i < length; i++) {
							elOption = el.options[i];
							optionVal = elOption.value;
							if (isArray) {
								elOption.selected = false;
								for (nlen = val.length; n < nlen; n++) {
									if (optionVal == val[n]) {
										elOption.selected = true;
										val.splice(n, 1);
										break;
									}
								}
							} else {
								return elOption.selected = val == optionVal;
							}
						}
						return false;
					} else if (el.type == "radio" || el.type == "checkbox") {
						el.checked = val == el.value;
						return val == el.value;
					} else {
						el.value = val;
						return true;
					}
				}

				// toplevel implementation
				return function (/* [value] */) {
					var args = arguments,
						val = args[0],
						that = this,
						i = 0,
						length = that.length;

					if (args.length === 0) {
						return that[0].nodeName == 'FORM' ?
							formValues(that[0]) :
							elementValue(that[0]);
					}
					if (that[0].nodeName == 'FORM') {
						if (! typeof val == 'object') {
							throw 'value for FORM must be object';
						}
						setFormValues(that[0], val);
					} else {
						for (; i < length; i++) {
							setValue(that[i], val);
						}
					}
					return that;
				};
			}(),

			/**
			@name glow.dom.NodeList#slice
			@function
			@description Extracts nodes from a NodeList and returns them as a new NodeList.

			@param {Number} start The NodeList index at which to begin extraction.

				If negative, this param specifies a position measured from
				the end of the NodeList

			@param {Number} [end] The NodeList index immediately after the end of the extraction.

				If not specified the extraction includes all nodes from the
				start to the end of the NodeList. A Negative end specifies
				an position measured from the end of the NodeList.

			@returns {glow.dom.NodeList}

				Returns a new NodeList containing the extracted nodes

			@example
				var myNodeList = glow.dom.create("<div></div><div></div>");
				myNodeList = myNodeList.slice(1, 2); // just second div
			 */
			slice: function (/* start, end */) {
				return new r.NodeList().push(Array.prototype.slice.apply(this, arguments));
			},

			/**
			@name glow.dom.NodeList#sort
			@function
			@description Returns a new NodeList containing the same nodes in order.

				Sort order defaults to document order if no sort function is passed in.

			@param {Function} [func] Function to determine sort order

				This function will be passed 2 nodes (a, b). The function
				should return a number less than 0 to sort a lower than b
				and greater than 0 to sort a higher than b.

			@returns {glow.dom.NodeList}

				Returns a new NodeList containing the sorted nodes

			@example
				// heading elements in document order
				var headings = glow.dom.get("h1, h2, h3, h4, h5, h6").sort();

				//get links in alphabetical (well, lexicographical) order
				var links = glow.dom.get("a").sort(function(a, b) {
					return ((a.textContent || a.innerText) < (b.textContent || b.innerText)) ? -1 : 1;
				})
			*/
			sort: function(func) {
				var that = this, i=0, aNodes;

				if (!that.length) { return that; }
				if (!func) {
					if (typeof that[0].sourceIndex == "number") {
						// sourceIndex is IE proprietary (but Opera supports)
						func = function(a, b) {
							return a.sourceIndex - b.sourceIndex;
						};
					} else if (that[0].compareDocumentPosition) {
						// DOM3 method
						func = function(a, b) {
							return 3 - (a.compareDocumentPosition(b) & 6);
						};
					} else {
						// js emulation of sourceIndex
						aNodes = getByTagName("*", [doc]);
						for (; aNodes[i]; i++) {
							aNodes[i]._sourceIndex = i;
						}
						func = function(a, b) {
							return a._sourceIndex - b._sourceIndex;
						};
					}
				}

				return r.get([].sort.call(that, func));
			},

			/**
			@name glow.dom.NodeList#filter
			@function
			@description Filter the NodeList using a function

				The supplied function will be called for each node in the NodeList.
				
				The index of the node will be provided as the first parameter, and
				'this' will refer to the node.
				
				Return true to keep the node, or false to remove it.

			@param {Function} func Function to test each node

			@returns {glow.dom.NodeList}

				Returns a new NodeList containing the filtered nodes

			@example
				// return images with a width greater than 320
				glow.dom.get("img").filter(function (i) {
					return this.width > 320;
				});
			 */
			filter: function(callback) {
				var ret = [], //result
					ri = 0,
					i = 0,
					length = this.length;
				for (; i < length; i++) {
					if (callback.apply(this[i], [i])) {
						ret[ri++] = this[i];
					}
				}
				return r.get(ret);
			},

			/**
			@name glow.dom.NodeList#children
			@function
			@description Gets the child elements of each node as a new NodeList.

			@returns {glow.dom.NodeList}

				Returns a new NodeList containing all the child nodes

			@example
				// get all list items
				var items = glow.dom.get("ul, ol").children();
			 */
			children: function() {
				var ret = [],
					ri = 0,
					i = 0,
					n = 0,
					length = this.length,
					childTmp;
				
				for (; i < length; i++) {
					ret = ret.concat( getChildElms(this[i]) );
				}
				return r.get(ret);
			},

			/**
			@name glow.dom.NodeList#parent
			@function
			@description Gets the unique parent nodes of each node as a new NodeList.
			The given nodelist will always be placed in the first element with no child elements.

			@returns {glow.dom.NodeList}

				Returns a new NodeList containing the parent nodes, with
				duplicates removed

			@example
				// elements which contain links
				var parents = glow.dom.get("a").parent();
			*/
			parent: function() {
				var ret = [],
					ri = 0,
					i = 0,
					length = this.length;

				for (; i < length; i++) {
					ret[ri++] = this[i].parentNode;
				}
				
				return r.get(unique(ret));
			},
			
			/**
			@name glow.dom.NodeList#ancestors
			@function
			@description Gets the unique ancestor nodes of each node as a new NodeList.

			@returns {glow.dom.NodeList}

				Returns NodeList

			@example
				// get ancestor elements for anchor elements 
				var ancestors = glow.dom.get("a").ancestors();
			*/
			ancestors: function() {
				var ret = [],
					ri = 0,
					i = 0,
					length = this.length,
					elm;
					
				while (i < length) {
					elm = this[i].parentNode;
					
					while (elm && elm.nodeType == 1) {							
						ret[ri++] = elm;
						elm = elm.parentNode;
					}								
					i++;
				}
				
				return r.get(unique(ret));
			},
			
			
			/**
			@name glow.dom.NodeList#wrap
			@function
			@description Wraps the given NodeList with the specified element(s).
			
				The given NodeList items will always be placed in the first child node that contains no further element nodes.
				
				Each item in a given NodeList will be wrapped individually.

			@returns {glow.dom.NodeList}

				Returns the NodeList with new wrapper parents

			@example
				// wrap the given element 
				glow.dom.get("p").wrap("<div></div>");
				// <div><p></p></div>
			*/
			wrap: function(wrapper) {
				var length = this.length,
					childElm,
					parent,
					wrappingNodes;
					
				if (typeof wrapper == 'string') {
					wrappingNodes = r.create(wrapper);
				}
				else {
					wrappingNodes = r.get(wrapper);
				}
						
				for (i=0; i < length; i++) {					
					parent = wrappingNodes[0];
					
					while (parent) {					
						childElm = getFirstChildElm(parent);
							
						if (childElm) {					
							parent = childElm;
						}
						else {
							break;
						}
					}							
					
					if (this[i].parentNode) {						
						wrappingNodes.insertBefore(this[i]);													
					}
					// If wrapping multiple nodes, we need to take a clean copy of the wrapping nodes
					if (i != length-1) {
						wrappingNodes = wrappingNodes.clone();
					}
					
					parent.appendChild(this[i]);

				}
				
				return this;
			},
			
			/**
			@name glow.dom.NodeList#unwrap
			@function
			@description Removes the first unique parent for each item of a supplied NodeList

			@returns {glow.dom.NodeList}

				Returns the unwrapped NodeList

			@example
				// Before: <div><div><p></p></div></div>
				// unwrap the given element
				glow.dom.get("p").unwrap();
				// After: <div><p></p></div>
			*/
			unwrap: function() {
				var toRemove,
					nodesToRemove = this.parent(),
					length = nodesToRemove.length;
				
				for (i=0; i < length; i++) {				
					toRemove = nodesToRemove.slice(i, i+1);
					// if the item we're removing has no new parent (i.e. is not in document), then we just remove the child and destroy the old parent
					if (!toRemove[0].parentNode){
						toRemove.children().remove();
						toRemove.destroy();
					}
					else {
						toRemove.children().insertBefore(toRemove);
						toRemove.destroy();							
					}						

				}
				return this;
			},

			/**
			@name glow.dom.NodeList#next
			@function
			@description Gets the next sibling element for each node as a new NodeList.

			@returns {glow.dom.NodeList}

				A new NodeList containing the next sibling elements.

			@example
				// gets the element following #myLink (if there is one)
				var next = glow.dom.get("#myLink").next();
			*/
			next: function() {
				return getNextOrPrev(this, "next");
			},

			/**
			@name glow.dom.NodeList#prev
			@function
			@description Gets the previous sibling element for each node as a new NodeList.

			@returns {glow.dom.NodeList}

				A new NodeList containing the previous sibling elements.

			@example
				// gets the elements before #myLink (if there is one)
				var previous = glow.dom.get("#myLink").previous();
			*/
			prev: function() {
				return getNextOrPrev(this, "previous");
			},

			/**
			@name glow.dom.NodeList#is
			@function
			@description Tests if all the nodes match a CSS selector.
			
				Jake: I'm deprecating this until we have time to make it faster (probably when we change our CSS selector engine)
			
			@deprecated
			@param {String} selector A CSS selector string

			@returns {Boolean}

			@example
				var bigHeadings = glow.dom.get("h1, h2, h3");

				// true
				if (bigHeadings.is("h1, h2, h3, h4, h5, h6")) ...

				// false
				if (bigHeadings.is("a")) ...
			*/
			is: function (selector) {
				// TODO - this implementation needs to be optimized
				var nodes = glow.dom.get(selector),
					i = 0,
					iLen = this.length,
					j,
					jLen;

				node:
				for (; i < iLen; i++) {
					for (j = 0, jLen = nodes.length; j < jLen; j++) {
						if (this[i] == nodes[j]) {
							continue node;
						}
					}
					return false;
				}
				return true;
			},

			/**
			@name glow.dom.NodeList#text
			@function
			@description Gets the inner text of the first node, or set the inner text of all matched nodes.

			@param {String} [text] String to set as inner text of nodes

			@returns {glow.dom.NodeList | String}

				If the text argument is passed then the NodeList is
				returned, otherwise the text is returned.

			@example
				// set text
				var div = glow.dom.create("<div></div>").text("Hello World!");

				// get text
				var greeting = div.text();
			*/
			text: function (/* text */) {
				var args = arguments,
					i = 0,
					that = this,
					length = that.length;

				if (args.length > 0) {
					for (; i < length; i++) {
						that[i].innerHTML = "";
						that[i].appendChild(doc.createTextNode(args[0]));
					}
					return that;
				}
				//innerText (empty) and textContent (undefined) don't work in safari 2 for hidden elements
				return that[0].innerText || that[0].textContent == undefined ? getTextNodeConcat(that[0]) : that[0].textContent;
			},

			/**
			@name glow.dom.NodeList#empty
			@function
			@description Removes the contents of all the nodes.

			@returns {glow.dom.NodeList}

			@example
				// remove the contents of all textareas
				glow.dom.get("textarea").empty();
			*/
			empty: function () {
				/*
				  NOTE: I changed this to destroy all nodes within the parent, but
				  seemed backwards incompatible with our own timetable demo
				  so we best hadn't do it until Glow 2
				*/
				var i = 0,
					len = this.length;
					
				for (; i < len; i++) {
					while(this[i].firstChild) {
						this[i].removeChild(this[i].firstChild);
					}
				}
				return this;
			},

			/**
			@name glow.dom.NodeList#remove
			@function
			@description Removes each node from its parent node.
				If you no longer need the nodes, consider using
				{@link glow.dom.NodeList#destroy destroy}
				
			@returns {glow.dom.NodeList}

			@example
				// take all the links out of a document
				glow.dom.get("a").remove();
			*/
			remove: function () {
				for (var that = this, i = 0, length = that.length, parentNode; i < length; i++) {
					if (parentNode = that[i].parentNode) {
						parentNode.removeChild(that[i]);
					}
				}
				return that;
			},
			
			/**
			@name glow.dom.NodeList#destroy
			@function
			@description Removes each node from the DOM
				The node will actually be destroyed to free up memory

			@returns {glow.dom.NodeList} An empty NodeList

			@example
				// destroy all links in the document
				glow.dom.get("a").destroy();
			*/
			destroy: function () {
				// remove any data attached to this NodeList
				this.get("*").push(this).removeData();
				
				this.appendTo(tmpDiv);
				// destroy nodes
				tmpDiv.innerHTML = "";
				// empty the nodelist
				
				Array.prototype.splice.call(this, 0, this.length);
				return this;
			},

			/**
			@name glow.dom.NodeList#clone
			@function
			@description Gets a new NodeList containing a clone of each node.
			
			@param {Boolean} [cloneListeners=false] Also clone any event listeners assigned using Glow
			
			@returns {glow.dom.NodeList}

				Returns a new NodeList containing clones of all the nodes in
				the NodeList

			@example
				// get a copy of all heading elements
				var myClones = glow.dom.get("h1, h2, h3, h4, h5, h6").clone();
				
			@example
				// get a copy of all anchor elements with 
				var myAnchors = glow.dom.get("a").clone(true);
			*/
			clone: function (cloneListeners) {
				var ret = [],
					i = this.length,
					allCloneElms,
					allBaseElms
					eventIdProp = '__eventId' + glow.UID;

				while (i--) {
					ret[i] = this[i].cloneNode(true);
				}
				
				// some browsers (ie) also clone node properties as attributes
				// we need to get rid of the eventId.
				allCloneElms = r.get( ret ).get("*").push( ret );
				if (nodePropertiesCloned && !isXml(ret[0])) {
					i = allCloneElms.length;
					while(i--) {
						allCloneElms[i][eventIdProp] = null;
					}
				}
				
				// copy data from base elements to clone elements
				allBaseElms = this.get("*").push( this );
				i = allCloneElms.length;
				while (i--) {
					allCloneElms[i].removeAttribute(dataPropName);
					glow.dom.get(allCloneElms[i]).data(
						glow.dom.get(allBaseElms[i]).data()
					);
				}
				
				// shall we clone events too?
				if (cloneListeners) {
					// check the stuff we need is hanging around, we don't want
					// glow.dom to be dependant on glow.events as it's a circular
					// dependency
					if ( !glow.events ) {
						throw "glow.events required to clone event listeners";
					}
					
					glow.events._copyListeners(
						this.get("*").push( this ),
						allCloneElms || r.get( ret ).get("*").push( ret )
					);
				}
				
				return r.get(ret);
			},

			/**
			@name glow.dom.NodeList#html
			@function
			@description Gets the HTML content of the first node, or set the HTML content of all nodes.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

			@param {String} [html] String to set as inner HTML of nodes

			@returns {glow.dom.NodeList | String}

				If the html argument is passed, then the NodeList is
				returned, otherwise the inner HTML of the first node is returned.

			@example
				// get the html in #footer
				var footerContents = glow.dom.get("#footer").html();

			@example
				// set a new footer
				glow.dom.get("#footer").html("<strong>Hello World!</strong>");
			*/
			html: function (newHtml) {
				var i = 0,
					length = this.length;

				if (newHtml !== undefined) {
					// not setting innerHTML, doesn't work in IE for elements like <table>
					return this.empty().append(newHtml);
				}
				return this[0] ? this[0].innerHTML : "";
			},

			/**
			@name glow.dom.NodeList#width
			@function
			@description Gets the width of the first node in pixels or sets the width of all nodes

				<p><em>This method is not applicable to XML NodeLists.</em></p>

				Return value does not include the padding or border of the
				element in browsers supporting the correct box model.

				You can use this to easily get the width of the document or
				window, see example below.

			@param {Number} [width] New width in pixels.

			@returns {glow.dom.NodeList | Number}

				Width of first element in pixels, or NodeList when setting widths

			@example
				// get the width of #myDiv
				glow.dom.get("#myDiv").width();

			@example
				// set the width of list items in #myDiv to 200 pixels
				glow.dom.get("#myDiv li").width(200);

			@example
				// get the height of the document
				glow.dom.get(document).width()

			@example
				// get the height of the window
				glow.dom.get(window).width()
			*/
			width: function(width) {
				if (width == undefined) {
					return getElmDimension(this[0], "width");
				}
				setElmsSize(this, width, "width");
				return this;
			},

			/**
			@name glow.dom.NodeList#height
			@function
			@description Gets the height of the first element in pixels or sets the height of all nodes

				<p><em>This method is not applicable to XML NodeLists.</em></p>

				 Return value does not include the padding or border of the element in
				 browsers supporting the correct box model.

				 You can use this to easily get the height of the document or
				 window, see example below.

			@param {Number} [height] New height in pixels.

			@returns {glow.dom.NodeList | Number}

				Height of first element in pixels, or NodeList when setting heights.

			@example
				// get the height of #myDiv
				glow.dom.get("#myDiv").height();

			@example
				// set the height of list items in #myDiv to 200 pixels
				glow.dom.get("#myDiv li").height(200);

			@example
				// get the height of the document
				glow.dom.get(document).height()

			@example
				// get the height of the window
				glow.dom.get(window).height()
			*/
			height: function(height) {
				if (height == undefined) {
					return getElmDimension(this[0], "height");
				}
				setElmsSize(this, height, "height");
				return this;
			},
			
			/**
			@name glow.dom.NodeList#scrollLeft
			@function
			@description Gets/sets the number of pixels the element has scrolled horizontally
				
				Get the value by calling without arguments, set by providing a new
				value.
				
				To get/set the scroll position of the window, use this method on
				a nodelist containing the window object.

			@param {Number} [val] New left scroll position

			@returns {glow.dom.NodeList | Number}

				Current scrollLeft value, or NodeList when setting scroll position.

			@example
				// get the scroll left value of #myDiv
				var scrollPos = glow.dom.get("#myDiv").scrollLeft();
				// scrollPos is a number, eg: 45

			@example
				// set the scroll left value of #myDiv to 20
				glow.dom.get("#myDiv").scrollLeft(20);

			@example
				// get the scrollLeft of the window
				var scrollPos = glow.dom.get(window).scrollLeft();
				// scrollPos is a number, eg: 45
			*/
			scrollLeft: function(val) {
				return scrollOffset(this, true, val);
			},
			
			/**
			@name glow.dom.NodeList#scrollTop
			@function
			@description Gets/sets the number of pixels the element has scrolled vertically
				
				Get the value by calling without arguments, set by providing a new
				value.
				
				To get/set the scroll position of the window, use this method on
				a nodelist containing the window object.

			@param {Number} [val] New top scroll position

			@returns {glow.dom.NodeList | Number}

				Current scrollTop value, or NodeList when setting scroll position.

			@example
				// get the scroll top value of #myDiv
				var scrollPos = glow.dom.get("#myDiv").scrollTop();
				// scrollPos is a number, eg: 45

			@example
				// set the scroll top value of #myDiv to 20
				glow.dom.get("#myDiv").scrollTop(20);

			@example
				// get the scrollTop of the window
				var scrollPos = glow.dom.get(window).scrollTop();
				// scrollPos is a number, eg: 45
			*/
			scrollTop: function(val) {
				return scrollOffset(this, false, val);
			},
			
			/**
			@name glow.dom.NodeList#show
			@function
			@description Shows all hidden items in the NodeList.
			@returns {glow.dom.NodeList}
			@example
				// Show element with ID myDiv
				glow.dom.get("#myDiv").show();
			@example
				// Show all list items within #myDiv
				glow.dom.get("#myDiv li").show();
			*/
			show: function() {
				var i = 0,
					len = this.length,
					currItem,
					itemStyle;
				for (; i < len; i++) {
					/* Create a NodeList for the current item */
					currItem = r.get(this[i]);
					itemStyle = currItem[0].style;
					if (currItem.css("display") == "none") {
						itemStyle.display = "";
						itemStyle.visibility = "visible";
						/* If display is still none, set to block */
						if (currItem.css("display") == "none") {
							itemStyle.display = "block";
						}
					}
				}
				return this;
			},

			/**
			@name glow.dom.NodeList#hide
			@function
			@description Hides all items in the NodeList.
			@returns {glow.dom.NodeList}
			@example
				// Hides all list items within #myDiv
				glow.dom.get("#myDiv li").hide();
			*/
			hide: function() {
				return this.css("display", "none").css("visibility", "hidden");
			},

			/**
			@name glow.dom.NodeList#css
			@function
			@description Gets a CSS property for the first node or sets a CSS property on all nodes.

				<p><em>This method is not applicable to XML NodeLists.</em></p>

				If a single property name is passed, the corresponding value
				from the first node will be returned.

				If a single property name is passed with a value, that value
				will be set on all nodes on the NodeList.

				If an array of properties name is passed with no value, the return
				value is the sum of those values from the first node in the NodeList.
				This can be useful for getting the total of left and right padding,
				for example.

				Return values are strings. For instance, "height" will return
				"25px" for an element 25 pixels high. You may want to use
				parseInt to convert these values.

				Here are the compatible properties you can get, if you use one
				which isn't on this list the return value may differ between browsers.

				<dl>
				<dt>width</dt><dd>Returns pixel width, eg "25px". Can be used even if width has not been set with CSS.</dd>
				<dt>height</dt><dd>Returns pixel height, eg "25px". Can be used even if height has not been set with CSS.</dd>
				<dt>top, right, bottom, left</dt><dd>Pixel position relative to positioned parent, or original location if position:relative, eg "10px". These can be used even if position:static.</dd>
				<dt>padding-top</dt><dd>Pixel size of top padding, eg "5px"</dd>
				<dt>padding-right</dt><dd>Pixel size of right padding, eg "5px"</dd>
				<dt>padding-bottom</dt><dd>Pixel size of bottom padding, eg "5px"</dd>
				<dt>padding-left</dt><dd>Pixel size of left padding, eg "5px"</dd>
				<dt>margin-top</dt><dd>Pixel size of top margin, eg "5px"</dd>
				<dt>margin-right</dt><dd>Pixel size of right margin, eg "5px"</dd>
				<dt>margin-bottom</dt><dd>Pixel size of bottom margin, eg "5px"</dd>
				<dt>margin-left</dt><dd>Pixel size of left margin, eg "5px"</dd>
				<dt>border-top-width</dt><dd>Pixel size of top border, eg "5px"</dd>
				<dt>border-right-width</dt><dd>Pixel size of right border, eg "5px"</dd>
				<dt>border-bottom-width</dt><dd>Pixel size of bottom border, eg "5px"</dd>
				<dt>border-left-width</dt><dd>Pixel size of left border, eg "5px"</dd>
				<dt>border-*-style</dt><dd>eg "dotted"</dd>
				<dt>border-*-color</dt><dd>returns colour in format "rgb(255, 255, 255)", return value also has properties r, g & b to get individual values as integers</dd>
				<dt>color</dt><dd>returns colour in format "rgb(255, 255, 255)", return value also has properties r, g & b to get individual values as integers</dd>
				<dt>list-style-position</dt><dd>eg "outside"</dd>
				<dt>list-style-type</dt><dd>eg "square"</dd>
				<dt>list-style-image</dt><dd>Returns full image path, eg "url(http://www.bbc.co.uk/lifestyle/images/bullets/1.gif)" or "none"</dd>
				<dt>background-image</dt><dd>Returns full image path, eg "url(http://www.bbc.co.uk/lifestyle/images/bgs/1.gif)" or "none"</dd>
				<dt>background-attachment</dt><dd>eg "scroll"</dd>
				<dt>background-repeat</dt><dd>eg "repeat-x"</dd>
				<dt>direction</dt><dd>eg "ltr"</dd>
				<dt>font-style</dt><dd>eg "italic"</dd>
				<dt>font-variant</dt><dd>eg "small-caps"</dd>
				<dt>line-height</dt><dd>Pixel height, eg "30px". Note, Opera may return value with 2 decimal places, eg "30.00px"</dd>
				<dt>letter-spacing</dt><dd>Pixel spacing, eg "10px"</dd>
				<dt>text-align</dt><dd>eg "right"</dd>
				<dt>text-decoration</dt><dd>eg "underline"</dd>
				<dt>text-indent</dt><dd>Pixel indent, eg "10px"</dd>
				<dt>white-space</dt><dd>eg "nowrap"</dd>
				<dt>word-spacing</dt><dd>Pixel spacing, eg "5px"</dd>
				<dt>float</dt><dd>eg "left"</dd>
				<dt>clear</dt><dd>eg "right"</dd>
				<dt>opacity</dt><dd>Value between 0 & 1. In IE, this value comes from the filter property (/100)</dd>
				<dt>position</dt><dd>eg "relative"</dd>
				<dt>z-index</dt><dd>eg "32"</dd>
				<dt>display</dt><dd>eg "block"</dd>
				<dt>text-transform</dt><dd>eg "uppercase"</dd>
				</dl>

				The following return values that may be usable but have differences in browsers

				<dl>
				<dt>font-family</dt><dd>Some browsers return the font used ("Verdana"), others return the full list found in the declaration ("madeup, verdana, sans-serif")</dd>
				<dt>font-size</dt><dd>Returns size as pixels except in IE, which will return the value in the same units it was set in ("0.9em")</dd>
				<dt>font-weight</dt><dd>Returns named values in some browsers ("bold"), returns computed weight in others ("700")</dd>
				</dl>

			@param {String | String[] | Object} property The CSS property name, array of names to sum, or object of key-value pairs

			@param {String} [value] The value to apply

			@returns {glow.dom.NodeList | String}

				Returns the CSS value from the first node, or NodeList when setting values

			@example
				// get value from first node
				glow.dom.get("#myDiv").css("display");

			@example
				// set left padding to 10px on all nodes
				glow.dom.get("#myDiv").css("padding-left", "10px");

			@example
				// "30px", total of left & right padding
				glow.dom.get("#myDiv").css(["padding-left", "padding-right"]);

			@example
				// where appropriate, px is assumed when no unit is passed
				glow.dom.get("#myDiv").css("height", 300);
		
			@example
				// set multiple CSS values at once
				// NOTE: Property names containing a hyphen such as font-weight must be quoted
				glow.dom.get("#myDiv").css({
					"font-weight": "bold",
					padding: "10px",
					color: "#00cc99"
				})
			*/
			css: function(prop, val) {
				var that = this,
					thisStyle,
					i = 0,
					len = that.length,
					originalProp = prop;

				if (prop.constructor === Object) { // set multiple values
					for (style in prop) {
						this.css(style, prop[style]);
					}
					return that;
				}
				else if (val != undefined) { //set one CSS value
					prop = toStyleProp(prop);
					for (; i < len; i++) {
						thisStyle = that[i].style;
						
						if (typeof val == "number" && hasUnits.test(originalProp)) {
							val = val.toString() + "px";
						}
						if (prop == "opacity" && env.ie) {
							//in IE the element needs hasLayout for opacity to work
							thisStyle.zoom = "1";
							if (val === "") {
								thisStyle.filter = "";
							} else {
								thisStyle.filter = "alpha(opacity=" + Math.round(Number(val, 10) * 100) + ")";
							}
						} else {
							thisStyle[prop] = val;
						}
					}
					return that;
				} else { //getting stuff
					if (!len) { return; }
					return getCssValue(that[0], prop);
				}
			},

			/**
			@name glow.dom.NodeList#offset
			@function
			@description Gets the offset from the top left of the document.
			
				If the NodeList contains multiple items, the offset of the
				first item is returned.

			@returns {Object}
				Returns an object with "top" & "left" properties in pixels

			@example
				glow.dom.get("#myDiv").offset().top
			*/
			offset: function () {
				// http://weblogs.asp.net/bleroy/archive/2008/01/29/getting-absolute-coordinates-from-a-dom-element.aspx - great bit of research, most bugfixes identified here (and also jquery trac)
				var elm = this[0],
					docScrollPos = {
						x: getScrollOffset(window, true),
						y: getScrollOffset(window, false)
					}

				//this is simple(r) if we can use 'getBoundingClientRect'
				// Sorry but the sooper dooper simple(r) way is not accurate in Safari 4
				if (!glow.env.webkit && elm.getBoundingClientRect) {
					var rect = elm.getBoundingClientRect();
					return {
						top: rect.top
							/*
							 getBoundingClientRect is realive to top left of
							 the viewport, so we need to sort out scrolling offset
							*/
							+ docScrollPos.y
							/*
							 IE adds the html element's border to the value. We can
							 deduct this value using client(Top|Left). However, if
							 the user has done html{border:0} clientTop will still
							 report a 2px border in IE quirksmode so offset will be off by 2.
							 Hopefully this is an edge case but we may have to revisit this
							 in future
							*/
							- docElm.clientTop,

						left: rect.left //see above for docs on all this stuff
							+ docScrollPos.x
							- docElm.clientLeft
					};
				} else { //damnit, let's go the long way around
					var top = elm.offsetTop,
						left = elm.offsetLeft,
						originalElm = elm,
						nodeNameLower,
						//does the parent chain contain a position:fixed element
						involvesFixedElement = false,
						offsetParentBeforeBody = elm;

					//add up all the offset positions
					while (elm = elm.offsetParent) {
						left += elm.offsetLeft;
						top += elm.offsetTop;

						//if css position is fixed, we need to add in the scroll offset too, catch it here
						if (getCssValue(elm, "position") == "fixed") {
							involvesFixedElement = true;
						}

						//gecko & webkit (safari 3) don't add on the border for positioned items
						if (env.gecko || env.webkit > 500) {
							left += parseInt(getCssValue(elm, "border-left-width")) || 0;
							top  += parseInt(getCssValue(elm, "border-top-width"))  || 0;
						}

						//we need the offset parent (before body) later
						if (elm.nodeName.toLowerCase() != "body") {
							offsetParentBeforeBody = elm;
						}
					}

					//deduct all the scroll offsets
					elm = originalElm;
					while ((elm = elm.parentNode) && (elm != docBody) && (elm != docElm)) {
						left -= elm.scrollLeft;
						top -= elm.scrollTop;

						//FIXES
						//gecko doesn't add the border of contained elements to the offset (overflow!=visible)
						if (env.gecko && getCssValue(elm, "overflow") != "visible") {
							left += parseInt(getCssValue(elm, "border-left-width"));
							top += parseInt(getCssValue(elm, "border-top-width"));
						}
					}

					//if we found a fixed position element we need to add the scroll offsets
					if (involvesFixedElement) {
						left += docScrollPos.x;
						top += docScrollPos.y;
					}

					//FIXES
					// Webkit < 500 body's offset gets counted twice for absolutely-positioned elements (or if there's a fixed element)
					// Gecko - non-absolutely positioned elements that are direct children of body get the body offset counted twice
					if (
						(env.webkit < 500 && (involvesFixedElement || getCssValue(offsetParentBeforeBody, "position") == "absolute")) ||
						(env.gecko && getCssValue(offsetParentBeforeBody, "position") != "absolute")
					) {
						left -= docBody.offsetLeft;
						top -= docBody.offsetTop;
					}

					return {left:left, top:top};
				}
			},
			
			/**
			@name glow.dom.NodeList#position
			@function
			@description Get the top & left position of an element relative to its positioned parent
				
				This is useful if you want to make a position:static element position:absolute
				and retain the original position of the element
				
			@returns {Object} An object with 'top' and 'left' number properties

			@example
				// get the top distance from the positioned parent
				glow.dom.get("#elm").position().top
			*/
			position: function() {
				var positionedParent = r.get( getPositionedParent(this[0]) ),
					hasPositionedParent = !!positionedParent[0],
					
					// element margins to deduct
					marginLeft = parseInt( this.css("margin-left") ) || 0,
					marginTop  = parseInt( this.css("margin-top")  ) || 0,
					
					// offset parent borders to deduct, set to zero if there's no positioned parent
					positionedParentBorderLeft = ( hasPositionedParent && parseInt( positionedParent.css("border-left-width") ) ) || 0,
					positionedParentBorderTop  = ( hasPositionedParent && parseInt( positionedParent.css("border-top-width")  ) ) || 0,
					
					// element offsets
					elOffset = this.offset(),
					positionedParentOffset = hasPositionedParent ? positionedParent.offset() : {top: 0, left: 0};
				
				return {
					left: elOffset.left - positionedParentOffset.left - marginLeft - positionedParentBorderLeft,
					top:  elOffset.top  - positionedParentOffset.top  - marginTop  - positionedParentBorderTop
				}
			},
			
			/**
			@name glow.dom.NodeList#append
			@function
			@description Appends the given elements to each node.

				If there is more than one node in the NodeList, then the given elements
				are appended to the first node and clones are appended to the other
				nodes.

				<p><em>String nodespecs cannot be used with XML NodeLists</em></p>

			@param {String | Element | glow.dom.NodeList} nodespec HTML string, Element or NodeList to append to each node.

			@returns {glow.dom.NodeList}

			@example
				// ends every paragraph with '...'
				glow.dom.get('p').append(
					'<span>...</span>'
				);
			*/
			append: function (nodeSpec) {
				var that = this,
					j = 0,
					i = 1,
					length = that.length,
					nodes;

				if (length == 0) { return that; }
				nodes = typeof nodeSpec == "string" ? nodelistToArray(stringToNodes(nodeSpec)) :
						nodeSpec.nodeType ? [nodeSpec] : nodelistToArray(nodeSpec);

				for (; nodes[j]; j++) {
					that[0].appendChild(nodes[j]);
				}
				for (; i < length; i++) {
					for (j = 0; nodes[j]; j++) {
						that[i].appendChild(nodes[j].cloneNode(true));
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#prepend
			@function
			@description Prepends the given elements to each node.

				If there is more than one node in the NodeList, then the given elements
				are prepended to the first node and clones are prepended to the other
				nodes.

				<p><em>String nodespecs cannot be used with XML NodeLists</em></p>

			@param {String | Element | glow.dom.NodeList} nodespec HTML string, Element or NodeList to prepend to each node.

			@returns {glow.dom.NodeList}

			@example
				// prepends every paragraph with 'Paragraph: '
				glow.dom.get('p').prepend(
					'<span>Paragraph: </span>'
				);
			*/
			prepend: function (nodeSpec) {
				var that = this,
					j = 0,
					i = 1,
					length = that.length,
					nodes,
					first;

				if (length == 0) { return that; }

				nodes = typeof nodeSpec == "string" ? nodelistToArray(stringToNodes(nodeSpec)) :
						nodeSpec.nodeType ? [nodeSpec] : nodelistToArray(nodeSpec);

				first = that[0].firstChild;

				for (; nodes[j]; j++) {
					that[0].insertBefore(nodes[j], first);
				}

				for (; i < length; i++) {
					first = that[i].firstChild;
					for (j = 0; nodes[j]; j++) {
						that[i].insertBefore(nodes[j].cloneNode(true), first);
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#appendTo
			@function
			@description Appends the NodeList to elements.

				If more than one element is given (i.e. if the nodespec argument
				is an array of nodes or a NodeList) the NodeList will be
				appended to the first element and clones to each subsequent
				element.

			@param {String | Element | glow.dom.NodeList} nodespec CSS selector string, Element or NodeList to append the NodeList to.

			@returns {glow.dom.NodeList}

			@example
				// appends '...' to every paragraph
				glow.dom.create('<span>...</span>').appendTo('p');
			*/
			appendTo: function (nodes) {
				if (! (nodes instanceof r.NodeList)) { nodes = r.get(nodes); }
				nodes.append(this);
				return this;
			},

			/**
			@name glow.dom.NodeList#prependTo
			@function
			@description Prepends the NodeList to elements.

				If more than one element is given (i.e. if the nodespec argument
				is an array of nodes or a NodeList) the NodeList will be
				prepended to the first element and clones to each subsequent
				element.

			@param {String | Element | glow.dom.NodeList} nodespec CSS selector string, Element or NodeList to prepend the NodeList to.

			@returns {glow.dom.NodeList}

			@example
				// prepends 'Paragraph: ' to every paragraph
				glow.dom.create('<span>Paragraph: </span>').prependTo('p');
			*/
			prependTo: function (nodes) {
				if (! (nodes instanceof r.NodeList)) { nodes = r.get(nodes); }
				nodes.prepend(this);
				return this;
			},

			/**
			@name glow.dom.NodeList#after
			@function
			@description Inserts elements after each node.

				If there is more than one node in the NodeList, the elements
				will be inserted after the first node and clones inserted
				after each subsequent node.

			@param {String | Element | glow.dom.NodeList} nodespec HTML string, Element or NodeList to insert after each node

			@returns {glow.dom.NodeList}

			@example
				// adds a paragraph after each heading
				glow.dom.get('h1, h2, h3').after('<p>...</p>');
			*/
			after: function (nodeSpec) {
				var that = this,
					length = that.length,
					nodes,
					nodesLen,
					j,
					i = 1,
					cloned;

				if (length == 0) { return that; }

				nodes = typeof nodeSpec == "string" ? r.create(nodeSpec) :
					nodeSpec instanceof r.NodeList ? nodeSpec :
					r.get(nodeSpec);

				nodesLen = nodes.length;

				for (j = nodesLen - 1; j >= 0; j--) {
					that[0].parentNode.insertBefore(nodes[j], that[0].nextSibling);
				}
				for (; i < length; i++) {
					cloned = nodes.clone();

					for (j = nodesLen - 1; j >= 0; j--) {
						that[i].parentNode.insertBefore(cloned[j], that[i].nextSibling);
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#before
			@function
			@description Inserts elements before each node.

				If there is more than one node in the NodeList, the elements
				will be inserted before the first node and clones inserted
				before each subsequent node.

			@param {String | Element | glow.dom.NodeList} nodespec HTML string, Element or NodeList to insert before each node

			@returns {glow.dom.NodeList}

			@example
				// adds a heading before each
				glow.dom.get('p').before('<h1>Paragraph:</h1>');
			*/
			before: function (nodeSpec) {
				var that = this,
					length = that.length,
					j = 0,
					i = 1,
					nodes,
					nodesLen,
					cloned;

				if (length == 0) { return that; }

				nodes = typeof nodeSpec == "string" ? r.create(nodeSpec) :
					nodeSpec instanceof r.NodeList ? nodeSpec :
					r.get(nodeSpec);

				nodesLen = nodes.length;

				for (; j < nodesLen; j++) {
					that[0].parentNode.insertBefore(nodes[j], that[0]);
				}
				for (; i < length; i++) {
					cloned = nodes.clone();
					for (j = 0; j < nodesLen; j++) {
						that[i].parentNode.insertBefore(cloned[j], that[i]);
					}
				}
				return that;
			},

			/**
			@name glow.dom.NodeList#insertAfter
			@function
			@description Insert the NodeList after each of the given elements.

				If more than one element is passed in, the NodeList will be
				inserted after the first element and clones inserted after each
				subsequent element.

			@param {String | Element | glow.dom.NodeList} nodespec CSS selector string, Element or NodeList to insert the NodeList after

			@returns {glow.dom.NodeList}

			@example
				// adds a paragraph after each heading
				glow.dom.create('<p>HAI!</p>').insertAfter('h1, h2, h3');
			*/
			insertAfter: function (nodes) {
				if (! (nodes instanceof r.NodeList)) { nodes = r.get(nodes); }
				nodes.after(this);
				return this;
			},

			/**
			@name glow.dom.NodeList#insertBefore
			@function
			@description Insert the NodeList before each of the given elements.

				If more than one element is passed in, the NodeList will be
				inserted before the first element and clones inserted before each
				subsequent element.

			@param {String | Element | glow.dom.NodeList} nodespec CSS selector string, Element or NodeList to insert the NodeList before

			@returns {glow.dom.NodeList}

			@example
				// adds a heading before each paragraph
				glow.dom.create('<h1>Paragraph:</h1>').insertBefore('p');
			*/
			insertBefore: function (nodes) {
				if (! (nodes instanceof r.NodeList)) { nodes = r.get(nodes); }
				nodes.before(this);
				return this;
			},


			/**
			@name glow.dom.NodeList#replaceWith
			@function
			@description Replace nodes on the page with given elements.

			@param {glow.dom.NodeList | String} nodespec Elements to insert into the document.

				If more than one node is to be replaced then nodespec will be
				cloned for additional elements. If a string is provided it will
				be treated as HTML and converted into elements.

			@returns {glow.dom.NodeList}
				Returns a new NodeList containing the nodes which have been removed
			*/
			replaceWith: function (nodeSpec) {
				/*
				 we need to put a placeholder in first in case the new stuff
				 has the same ids as stuff being replaced. This causes issues
				 in safari 2, the new element can't be picked up with getElementById
				*/
				if (env.webkit < 500) {
					this.after(placeholderElm).remove();
					r.get("u.glow-placeholder").after(nodeSpec).remove();
				} else {
					this.after(nodeSpec).remove()
				}
				return this;
			},
			
			/**
			@name glow.dom.NodeList#data
			@function
			@description Use this to safely attach arbitrary data to any DOM Element.
			
			This method is useful when you wish to avoid memory leaks that are possible when adding your own data directly to DOM Elements.
			
			When called with no arguments, will return glow's entire data store for the first item in the NodeList.
			
			Otherwise, when given a stringy key, will return the associated value from the first item in the NodeList.
			
			When given both a key and a value, will store that data on every item in the NodeList.
			
			Optionally you can pass in a single object composed of multiple key, value pairs.
			
			@param {String|Object} [key] The name of the value in glow's data store for the NodeList item.
			@param {Object} [val] The the value you wish to associate with the given key.
			@see glow.dom.NodeList#removeData
			@example
			
			glow.dom.get("p").data("tea", "milky");
			var colour = glow.dom.get("p").data("tea"); // milky
			@returns {Object} When setting a value this method can be chained, as in that case it will return itself.
			*/
			data: function (key, val) { /*debug*///console.log("data("+key+", "+val+")");
				if (typeof key === "object") { // setting many values
					for (var prop in key) { this.data(prop, key[prop]); }
					return this; // chainable with ({key: val}) signature
				}
				
				var index,
					elm;
					// uses private class-scoped variables: dataCache, dataPropName, dataIndex
				
				switch (arguments.length) {
					case 0: // getting entire cache from first node
						if (this[0] === undefined) { return undefined; }
						index = this[0][dataPropName] || dataIndex++;
						return dataCache[index] || (dataCache[index] = {}); // create a new cache when reading entire cache
					case 1:  // getting val from first node
						if (this[0] === undefined) { return undefined; }
						index = this[0][dataPropName]; // don't create a new cache when reading just a specific val
						return index? dataCache[index][key] : undefined;
					case 2: // setting key:val on every node
						// TODO - need to defend against reserved words being used as keys?
						for (var i = this.length; i--;) {
							elm = this[i];
							
							if ( !(index = elm[dataPropName]) ) { // assumes index is always > 0
								index = dataIndex++;
								
								elm[dataPropName] = index;
								dataCache[index] = {};
							}
							dataCache[index][key] = val;
						}
						
						return this; // chainable with (key, val) signature
					default:
						throw new Error("glow.dom.NodeList#data expects 2 or less arguments, not "+arguments.length+".");
				}
			},
			
			/**
			@name glow.dom.NodeList#removeData
			@function
			@description Removes data previously added by {@link glow.dom.NodeList#data} from items in a NodeList.
			
			When called with no arguments, will delete glow's entire data store for every item in the NodeList.
			
			Otherwise, when given a key, will delete the associated value from every item in the NodeList.
			
			@param {String} [key] The name of the value in glow's data store for the NodeList item.
			*/
			removeData: function (key) { /*debug*///console.log("removeData("+key+")");
				var elm,
					i = this.length,
					index;
					// uses private class-scoped variables: dataCache, dataPropName
				
				while (i--) {
					elm = this[i];
					index = elm[dataPropName];
					
					if (index !== undefined) {
						switch (arguments.length) {
							case 0:
								dataCache[index] = undefined;
								elm[dataPropName] = undefined;
								try {
									delete elm[dataPropName]; // IE 6 goes wobbly here
								}
								catch(e) { // remove expando from IE 6
									elm.removeAttribute && elm.removeAttribute(dataPropName);
								}
								break;
							case 1:
								dataCache[index][key] = undefined;
								delete dataCache[index][key];
								break;
							default:
								throw new Error("glow.dom.NodeList#removeData expects 1 or less arguments, not "+arguments.length+".");
						}
					}
				}
				
				return this; // chainable
			},

			/**
			@name glow.dom.NodeList#get
			@function
			@description Gets decendents of nodes that match a CSS selector.

			@param {String} selector CSS selector

			@returns {glow.dom.NodeList}
				Returns a new NodeList containing matched elements

			@example
				// create a new NodeList
				var myNodeList = glow.dom.create("<div><a href='s.html'>Link</a></div>");

				// get 'a' tags that are decendants of the NodeList nodes
				myNewNodeList = myNodeList.get("a");
			*/
			get: function() {

				/*
				PrivateFunction: compileSelector
					Compile a CSS selector to an AST.

				Arguments:
					sSelector - A string containing the CSS selector (or comma separated group of selectors).

				Returns:
					An array containing an AST for each selector in the group.
				*/
				function compileSelector(sSelector) {
					//return from cache if possible
					if (cssCache[sSelector]) {
						return cssCache[sSelector];
					}

					var r = [], //array of result objects
						ri = 0, //results index
						comb, //current combinator
						tagTmp,
						idTmp,
						aRx, //temp regex result
						matchedCondition, //have we matched a condition?
						sLastSelector, //holds last copy of selector to prevent infinite loop
						firstLoop = true,
						originalSelector = sSelector;

					while (sSelector && sSelector != sLastSelector) {
						tagTmp = "";
						idTmp = "";
						//protect us from infinite loop
						sLastSelector = sSelector;

						//start by getting the scope (combinator)
						if (aRx = cssRegex.combinator.exec(sSelector)) {
							comb = aRx[1];
							sSelector = sSelector.slice(aRx[0].length);
						}
						//look for optimal id & tag searching
						if (aRx = cssRegex.tagName.exec(sSelector)) {
							tagTmp = aRx[1];
							sSelector = sSelector.slice(aRx[0].length);
						}
						if (aRx = cssRegex.classNameOrId.exec(sSelector)) {
							if (aRx[1] == "#") {
								idTmp = aRx[2];
								sSelector = sSelector.slice(aRx[0].length);
							}
						}
						if (!comb) { //use native stuff
							if (idTmp && firstLoop) {
								r[ri++] = [getByIdQuick, [idTmp.replace(/\\/g, ""), tagTmp || "*", null]];
							} else {
								r[ri++] = [getByTagName, [tagTmp || "*", null]];
								if (idTmp) {
									r[ri++] = [hasId, [idTmp.replace(/\\/g, ""), null]];
								}
							}
						} else if (comb == ">") {
							r[ri++] = [getChildren, [null]];
							if (idTmp) {
								r[ri++] = [hasId, [idTmp.replace(/\\/g, ""), null]];
							}
							if (tagTmp && tagTmp != "*") { //uses tag
								r[ri++] = [isTag, [tagTmp, null]];
							}
						}

						//other conditions can appear in any order, so here we go:
						matchedCondition = true;
						while (matchedCondition) {
							//look for class or ID
							if (sSelector.charAt(0) == "#" || sSelector.charAt(0) == ".") {
								if (aRx = cssRegex.classNameOrId.exec(sSelector)) {
									if (sSelector.charAt(0) == "#") { //is ID
										//define ID, remove escape chars
										r[ri++] = [hasId, [aRx[2].replace(/\\/g, ""), null]];
									} else { //is class
										r[ri++] = [hasClassName, [aRx[2].replace(/\\/g, ""), null]];
									}
									sSelector = sSelector.slice(aRx[0].length);
								} else {
									throw new Error("Invalid Selector " + originalSelector);
								}
							} else {
								matchedCondition = false;
							}
						}

						firstLoop = false;
					}

					if (sSelector !== "") {
						throw new Error("Invalid Selector " + originalSelector);
					}

					//add to cache and return
					return cssCache[sSelector] = r;
				}

				/*
				PrivateFunction: fetchElements
					Get elements which match array of compiled conditions based on
					an initial context.

				Arguments:
					a - (object) CSS selector AST object.
					initialContext - DOM Element or DOM Document to search within.

				Returns:
					An array of matching elements.
				*/
				function fetchElements(a, initialContext) {
					var context = initialContext; //elements to look within

					for (var i = 0, al = a.length; i < al; i++) {
						a[i][1][a[i][1].length - 1] = context;
						context = a[i][0].apply(this, a[i][1]);
					}
					return context;
				}

				/*
				PrivateFunction: getByIdQuick
					Get an element with a specific tag name, within a context.

				Arguments:
					id - (string) the id of the element.
					tagName - (string) the name of the element.
					context - DOM Element or DOM Document in which to find the element.

				Returns:
					A DOM Element matching the specified criteria.
				*/
				function getByIdQuick(id, tagName, context) {
					var r = [], ri = 0, notQuick = [], notQuicki = 0, tmpNode;
					for (var i = 0, length = context.length; i < length; i++) {
						if (context[i].getElementById) {
							tmpNode = context[i].getElementById(id);
							if (tmpNode && (tmpNode.tagName == tagName.toUpperCase() || tagName == "*" || tmpNode.tagName == tagName)) {
								r[ri++] = tmpNode;
							}
						} else {
							notQuick[notQuicki++] = context[i];
						}
					}
					//deal with the ones we couldn't do quick
					if (notQuick[0]) {
						notQuick = getByTagName(tagName, notQuick);
						notQuick = hasId(id, notQuick);
					}
					return r.concat(notQuick);
				}

				function getChildren(context) {
					var r = [],
						i = 0,
						len = context.length;
						
					for (; i < len; i++) {
						append( r, getChildElms(context[i]) );
					}
					return r;
				}

				function hasId(id, context) {
					for (var i = 0, length = context.length; i < length; i++) {
						if (context[i].id == id) {
							//is this a safe optimisation?
							return [context[i]];
						}
					}
					return [];
				}

				/*
				PrivateFunction: isTag
					Get an array of elements within an array that have a given tag name.

				Arguments:
					tagName - (string) the name of the element.
					context - (array) elements to match.

				Returns:
					An array of matching elements.
				*/
				function isTag(tagName, context) {
					var r = [], ri = 0;
					for (var i = 0, length = context.length; i < length; i++) {
						if (context[i].tagName == tagName.toUpperCase() || context[i].tagName == tagName) {
							r[ri++] = context[i];
						}
					}
					return r;
				}

				/*
				PrivateFunction: hasClassName
					Get elements that have a given class name from a provided array of elements.

				Arguments:
					className - (string) the name of the class.
					context - (array) the DOM Elements to match.

				Returns:
					An array of matching DOM Elements.
				*/
				function hasClassName(className, context) {
					var r = [], ri = 0;
					for (var i = 0, length = context.length; i < length; i++) {
						if ((" " + context[i].className + " ").indexOf(" " + className + " ") != -1) {
							r[ri++] = context[i];
						}
					}
					return r;
				}

				/*
				PrivateFunction: getBySelector
					Get elements within a context by a CSS selector.

				Arugments:
					sSelector - (string) CSS selector.
					context - DOM Document or DOM Element to search within.

				Returns:
					An array of DOM Elements.
				*/
				function getBySelector(sSelector, context) {
					var aCompiledCSS; // holds current compiled css statement
					var r = [];
					//split multiple selectors up
					var aSelectors = sSelector.split(",");
					//process each
					for (var i = 0, nSelLen = aSelectors.length; i < nSelLen; i++) {
						aCompiledCSS = compileSelector(glow.lang.trim(aSelectors[i]));
						//get elements from DOM
						r = r.concat(fetchElements(aCompiledCSS, context));
					}
					return r;
				}

				/*
				PrivateFunction: getIfWithinContext
					Get elements from a set of elements that are within at least one of another
					set of DOM Elements.

				Arguments:
					nodes - DOM Elements to take the results from.
					context - DOM Elements that returned elements must be within.

				Returns:
					An array of DOM Elements.
				*/
				function getIfWithinContext(nodes, context) {
					nodes = nodes.length ? nodes : [nodes];
					var r = []; //to return
					var nl;

					//loop through nodes
					for (var i = 0; nodes[i]; i++) {
						nl = glow.dom.get(nodes[i]);
						//loop through context nodes
						for (var n = 0; context[n]; n++) {
							if (nl.isWithin(context[n])) {
								r[r.length] = nl[0];
								break;
							}
						}
					}
					return r;
				}
				
				// main implementation
				return function(sSelector) {
					// no point trying if there's no current context
					if (!this.length) { return this; }

					var r = []; //nodes to return
					// decide what to do by arg
					for (var i = 0, argLen = arguments.length; i < argLen; i++) {
						if (typeof arguments[i] == "string") { // css selector string
							r = r.concat(getBySelector(arguments[i], this));
							// append(r, getBySelector(arguments[i], this));
						} else { // nodelist, array, node
							r = r.concat(getIfWithinContext(arguments[i], this));
							// append(r, getIfWithinContext(arguments[i], this));
						}
					}

					// strip out duplicates, wrap in nodelist
					return glow.dom.get(unique(r));
				};
			}()
		};

		//some init stuff. Using u to make it quicker to get by tag name :)
		placeholderElm = r.create('<u class="glow-placeholder"></u>');
		//set up glow.dom
		glow.dom = r;

	}
});
/**
@name glow.events
@namespace
@description Native browser and custom events
@see <a href="../furtherinfo/events/">Using event listeners</a>
@see <a href="../furtherinfo/events/firing_events.shtml">Firing event listeners</a>
@see <a href="../furtherinfo/events/removing_event_listeners.shtml">Removing event listeners</a>
*/
(window.gloader || glow).module({
	name: "glow.events",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", 'glow.dom']],
	builder: function(glow) {
		
		var $ = glow.dom.get;
		var r = {};
		var eventid = 1;
		var objid = 1;
		// object (keyed by obj id), containing object (keyed by event name), containing arrays of listeners
		var listenersByObjId = {};
		// object (keyed by ident) containing listeners
		var listenersByEventId = {};
		var domListeners = {};
		var psuedoPrivateEventKey = '__eventId' + glow.UID;
		var psuedoPreventDefaultKey = psuedoPrivateEventKey + 'PreventDefault';
		var psuedoStopPropagationKey = psuedoPrivateEventKey + 'StopPropagation';

		var topKeyListeners = {};
		var keyListenerId = 1;
		var keyListeners = {};
		var keyTypes = {};

		var CTRL = 1;
		var ALT = 2;
		var SHIFT = 4;

		var specialPrintables = {
			TAB      : '\t',
			SPACE    : ' ',
			ENTER    : '\n',
			BACKTICK : '`'
		};

		var keyNameAliases = {
			'96' : 223
		};

		var keyNameToCode = {
			CAPSLOCK : 20, NUMLOCK : 144, SCROLLLOCK : 145, BREAK : 19,
			BACKTICK : 223, BACKSPACE : 8, PRINTSCREEN : 44, MENU : 93, SPACE : 32,
			SHIFT : 16,  CTRL : 17,  ALT : 18,
			ESC   : 27,  TAB  : 9,   META     : 91,  RIGHTMETA : 92, ENTER : 13,
			F1    : 112, F2   : 113, F3       : 114, F4        : 115,
			F5    : 116, F6   : 117, F7       : 118, F8        : 119,
			F9    : 120, F10  : 121, F11      : 122, F12       : 123,
			INS   : 45,  HOME : 36,  PAGEUP   : 33,
			DEL   : 46,  END  : 35,  PAGEDOWN : 34,
			LEFT  : 37,  UP   : 38,  RIGHT    : 39,  DOWN      : 40
		};
		var codeToKeyName = {};
		for (var i in keyNameToCode) {
			codeToKeyName['' + keyNameToCode[i]] = i;
		}

		var operaBrokenChars = '0123456789=;\'\\\/#,.-';

		/*
		PrivateMethod: removeKeyListener
			Removes a listener for a key combination.
		
		Arguments:
			ident - identifier returned from addKeyListener.
		*/

		function removeKeyListener (ident) {
			var keyType = keyTypes[ident];
			if (! keyType) { return false; }
			var listeners = keyListeners[keyType];
			if (! listeners) { return false; }
			for (var i = 0, len = listeners.length; i < len; i++) {
				if (listeners[i][0] == ident) {
					listeners.splice(i, 1);
					return true;
				}
			}
			return false;
		}

		/*
		PrivateMethod: initTopKeyListner
			Adds an event listener for keyboard events, for key listeners added by addKeyListener.

		Arguments:
			type - press|down|up - the type of key event.
		*/

		function initTopKeyListener (type) {
			topKeyListeners[type] = r.addListener(document, 'key' + type, function (e) {
				var mods = 0;
				if (e.ctrlKey) { mods += CTRL; }
				if (e.altKey) { mods += ALT; }
				if (e.shiftKey) { mods += SHIFT; }
				var keyType = e.chr ? e.chr.toLowerCase() : e.key ? e.key.toLowerCase() : e.keyCode;
				var eventType = mods + ':' + keyType + ':' + type;
				var listeners = keyListeners[eventType] ? keyListeners[eventType].slice(0) : [];
				// if the user pressed shift, but event didn't specify that, include it
				if (e.shiftKey) { // upper-case letter, should match regardless of shift
					var shiftEventType = (mods & ~ SHIFT) + ':' + keyType + ':' + type;
					if (keyListeners[shiftEventType]) {
						for (var i = 0, len = keyListeners[shiftEventType].length; i < len; i++) {
							listeners[listeners.length] = keyListeners[shiftEventType][i];
						}
					}
				}
				
				if (! listeners) { return; }
				
				for (var i = 0, len = listeners.length; i < len; i++) {
					//call listener and look out for preventing the default
					if (listeners[i][2].call(listeners[i][3] || this, e) === false) {
						e.preventDefault();
					}
				}
				return !e.defaultPrevented();
			});
		}
		
		/*
		PrivateMethod: clearEvents
			Removes all current listeners to avoid IE mem leakage
		*/
		function clearEvents() {
			var ident;
			for (ident in listenersByEventId) {
				r.removeListener(ident);
			}
		}

		// for opera madness
		var previousKeyDownKeyCode;

		var operaResizeListener,
			operaDocScrollListener;

		/*
		PrivateMethod: addDomListener
			Adds an event listener to a browser object. Manages differences with certain events.

		Arguments:
			attachTo - the browser object to attach the event to.
			name - the generic name of the event (inc. mousewheel)
		*/
		function addDomListener (attachTo, name, capturingMode) {
			var wheelEventName;

			capturingMode = !!capturingMode;
			
			if (glow.env.opera) {
				if (name.toLowerCase() == 'resize' && !operaResizeListener && attachTo == window) {
					operaResizeListener = r.addListener(window.document.body, 'resize', function (e) { r.fire(window, 'resize', e); });
				} else if (name.toLowerCase() == 'scroll' && !operaDocScrollListener && attachTo == window) {
					operaDocScrollListener = r.addListener(window.document, 'scroll', function (e) { r.fire(window, 'scroll', e); });
				}
			}
			
			var callback = function (e) {
				if (! e) { e = window.event; }
				var event = new r.Event(),
					lowerCaseName = name.toLowerCase();
				event.nativeEvent = e;
				event.source = e.target || e.srcElement;

				event.relatedTarget = e.relatedTarget || (lowerCaseName == "mouseover" ? e.fromElement : e.toElement);
			    event.button = glow.env.ie ? (e.button & 1 ? 0 : e.button & 2 ? 2 : 1) : e.button;
				if (e.pageX || e.pageY) {
					event.pageX = e.pageX;
					event.pageY = e.pageY;
				} else if (e.clientX || e.clientY) 	{
					event.pageX = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
					event.pageY = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
				}
				if (lowerCaseName == 'mousewheel') {
					// this works in latest opera, but have read that it needs to be switched in direction
					// if there was an opera bug, I can't find which version it was fixed in
					event.wheelDelta =
						e.wheelDelta ? e.wheelDelta / 120 :
						e.detail ? - e.detail / 3 :
							0;
					if (event.wheelDelta == 0) { return; }
				}
				if (lowerCaseName.indexOf("key") != -1) {
					event.altKey = !! e.altKey;
					event.ctrlKey = !! e.ctrlKey;
					event.shiftKey = !! e.shiftKey;

					if (name == 'keydown') {
						previousKeyDownKeyCode = e.keyCode;
					}

					event.charCode = e.keyCode && e.charCode !== 0 ? undefined : e.charCode;

					if (lowerCaseName == 'keypress') {
						if (typeof(event.charCode) == 'undefined') {
							event.charCode = e.keyCode;
						}

						if (glow.env.opera && event.charCode && event.charCode == previousKeyDownKeyCode &&
							operaBrokenChars.indexOf(String.fromCharCode(event.charCode)) == -1
						) {
							event.charCode = undefined;
							event.keyCode = previousKeyDownKeyCode;
						}
					}
					
					// make things a little more sane in opera
					if (event.charCode && event.charCode <= 49) { event.charCode = undefined; }

					if (event.charCode) {
						event.chr = String.fromCharCode(event.charCode);
					}
					else if (e.keyCode) {
						event.charCode = undefined;
						event.keyCode = keyNameAliases[e.keyCode.toString()] || e.keyCode;
						event.key = codeToKeyName[event.keyCode];
						if (specialPrintables[event.key]) {
							event.chr = specialPrintables[event.key];
							event.charCode = event.chr.charCodeAt(0);
						}
					}

					if (event.chr) {
						event.capsLock =
							event.chr.toUpperCase() != event.chr ? // is lower case
								event.shiftKey :
							event.chr.toLowerCase() != event.chr ? // is upper case
								! event.shiftKey :
								undefined; // can only tell for keys with case
					}
				}

				r.fire(this, name, event);
				if (event.defaultPrevented()) {
					return false;
				}
			};


			if (attachTo.addEventListener && (!glow.env.webkit || glow.env.webkit > 418)) {

				// This is to fix an issue between Opera and everything else.
				// Opera needs to have an empty eventListener attached to the parent
				// in order to fire a captured event (in our case we are using capture if
				// the event is focus/blur) on an element when the element is the eventTarget.
				//
				// It is only happening in Opera 9, Opera 10 doesn't show this behaviour.
				// It looks like Opera has a bug, but according to the W3C Opera is correct...
				//
				// "A capturing EventListener will not be triggered by events dispatched 
				// directly to the EventTarget upon which it is registered."
				// http://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-flow-capture
				if (
					( name == 'focus' || name == 'blur' )
					&& (glow.env.opera)
				) {
					attachTo.parentNode.addEventListener(name, function(){}, true);
				}

				attachTo.addEventListener(name.toLowerCase() == 'mousewheel' && glow.env.gecko ? 'DOMMouseScroll' : name, callback, capturingMode);

			} else {

				var onName = 'on' + name;
				var existing = attachTo[onName];
				if (existing) {
					attachTo[onName] = function () {
						// we still need to return false if either the existing or new callback returns false
						var existingReturn = existing.apply(this, arguments),
							callbackReturn = callback.apply(this, arguments);
						
						return (existingReturn !== false) && (callbackReturn !== false);
					};
				} else {
					attachTo[onName] = callback;
				}

			}

			attachTo = null;

		}
		
		/**
		Add mouseEnter or mouseLeave 'event' to an element
		@private
		@param {HTMLElement} attachTo Element to create mouseenter / mouseleave for
		@param {Boolean} isLeave Create mouseleave or mouseenter?
		*/
		function addMouseEnterLeaveEvent(attachTo, isLeave) {
			var elm = $(attachTo),
				listenFor = isLeave ? "mouseout" : "mouseover",
				toFire = isLeave ? "mouseleave" : "mouseenter";
			
			r.addListener(attachTo, listenFor, function(e) {
				var relatedTarget = $(e.relatedTarget);
				// if the mouse has come from outside elm...
				if ( !relatedTarget.eq(elm) && !relatedTarget.isWithin(elm) ) {
					// return false if default is prevented by mouseEnter event
					return !r.fire(elm[0], toFire, e).defaultPrevented();
				}
			})
		}
		
		/**
		@name glow.events._copyListeners 
		@function
		@private
		@description Maps event listeners from one set of nodes to another in the order they appear in each NodeList.
			Note, it doesn't copy events from a node's children.
		
		
		@param {NodeList} from NodeList to copy events from
		@param {NodeList} to NodeList to copy events to
	
		@returns {Boolean}
		
		@example
			var listener = glow.events.addListener(...);
			glow.events.removeListener(listener);
		*/
		r._copyListeners = function(from, to) {
			// grab all the elements (including children)
			var i = from.length,
				// events attached to a particular element
				elementEvents,
				// name of the current event we're looking at
				eventName,
				// current listener index
				listenerIndex,
				// number of listeners to an event
				listenersLen,
				// listener definition from listenersByObjId
				listener;
			
			// loop through all items
			while(i--) {
				// has a glow event been assigned to this node?
				if ( from[i][psuedoPrivateEventKey] ) {
					// get listeners for that event
					elementEvents = listenersByObjId[ from[i][psuedoPrivateEventKey] ];
					// loop through event names
					for (eventName in elementEvents) {
						listenerIndex = 0;
						listenersLen = elementEvents[eventName].length;
						// loop through listeners to that event
						for (; listenerIndex < listenersLen; listenerIndex++) {
							listener = elementEvents[eventName][listenerIndex];
							// listen to them on the clone
							r.addListener(to[i], eventName, listener[2], listener[3]);
						}
					}
				}
			}
		}

		/**
		@name glow.events.addListener
		@function
		@description Adds an event listener to an object (e.g. a DOM Element or Glow widget).
		
			Some non-standard dom events are available:
			
			<dl>
				<dt>mouseenter</dt>
				<dd>Fires when the mouse enters this element specifically, does not bubble</dd>
				<dt>mouseleave/dt>
				<dd>Fires when the mouse leaves this element specifically, does not bubble</dd>
			</dl>
		
		@param {String | NodeList | Object} attachTo The object to attach the event listener to.
		
			If the parameter is a string, then it is treated as a CSS selector 
			and the listener is attached to all matching elements.
		   	
		   	If the parameter is a {@link glow.dom.NodeList}, then the listener 
		   	is attached to all elements in the NodeList.
		
		@param {String} name The event name. 
		
			Listeners for DOM events should not begin with 'on' (i.e. 'click' 
			rather than 'onclick')
				   
		@param {Function} callback The function to be called when the event fires.
			
		@param {Object} [context] The execution scope of the callback.
		
			If this parameter is not passed then the attachTo object will be the 
			scope of the callback.
		
		@returns {Number | Undefined}
		
			A unique identifier for the event suitable for passing to 
			{@link glow.events.removeListener}. If an empty NodeList or CSS 
			selector that returns no elements is passed, then undefined is returned.
		
		@example
			glow.events.addListener('#nav',	'click', function () {
				alert('nav clicked');
			});

			glow.events.addListener(myLightBox, 'close', this.showSurvey, this);
		*/
		r.addListener = function (attachTo, name, callback, context) {
			var capturingMode = false;
			if (! attachTo) { throw 'no attachTo paramter passed to addListener'; }

			if (typeof attachTo == 'string') {
				if (! glow.dom) { throw "glow.dom must be loaded to use a selector as the first argument to glow.events.addListener"; }
				attachTo = $(attachTo);
			}
			
			if (glow.dom && attachTo instanceof glow.dom.NodeList) {
				var listenerIds = [],
					i = attachTo.length;

				//attach the event for each element, return an array of listener ids
				while (i--) {
					listenerIds[i] = r.addListener(attachTo[i], name, callback, context);
				}
				
				return listenerIds;
			}
	
			var objIdent;
			if (! (objIdent = attachTo[psuedoPrivateEventKey])) {
				objIdent = attachTo[psuedoPrivateEventKey] = objid++;
			}
			var ident = eventid++;
			var listener = [ objIdent, name, callback, context, ident ];
			listenersByEventId[ident] = listener;

			var objListeners = listenersByObjId[objIdent];
			if (! objListeners) { objListeners = listenersByObjId[objIdent] = {}; }
			var objEventListeners = objListeners[name];
			if (! objEventListeners) { objEventListeners = objListeners[name] = []; }
			objEventListeners[objEventListeners.length] = listener;
			
			if ((attachTo.addEventListener || attachTo.attachEvent) && ! domListeners[objIdent + ':' + name]) {
				// handle 'special' dom events (ie, ones that aren't directly mapped to real dom events)
				// we don't actually add a dom listener for these event names
				switch (name) {
					case "mouseenter":
						addMouseEnterLeaveEvent(attachTo, false);
						return ident;
					case "mouseleave":
						addMouseEnterLeaveEvent(attachTo, true);
						return ident;

					// Focus and blur events:
					// Convert focus/blur events to use capturing.
					// This allows form elements to be used with event delegation.

					case "focus":
						// IE
						// If IE then change focus/blur events to focusin/focusout events.
						// This allows input elements to bubble, so form elements work with event delegation.
						if (glow.env.ie) {
							addFocusInOutEvent(attachTo, true);
							return ident;
						}
						// Everything else
						else {
							capturingMode = true
						}
						break;

					case "blur":
						// IE
						// If IE then change focus/blur events to focusin/focusout events.
						// This allows input elements to bubble, so form elements work with event delegation.
						if (glow.env.ie) {
							addFocusInOutEvent(attachTo, false);
							return ident;
						}
						// Everything else
						else {
							capturingMode = true
						}
						break;

				}
				
				addDomListener(attachTo, name, capturingMode);
				domListeners[objIdent + ':' + name] = true;
			}
			return ident;
		};

		/**
		Add focusIn or focusOut 'event' to an element
		@private
		@param {HTMLElement} attachTo Element to create focusIn / focusOut for
		@param {Boolean} event Create focusIn or focusOut?
		*/
		function addFocusInOutEvent(attachTo, event) {
			var listenFor = event ? 'focusin' : 'focusout',
				toFire    = event ? 'focus'   : 'blur';
			r.addListener(attachTo, listenFor, function(e) {
				return !r.fire(attachTo, toFire, e).defaultPrevented();
			});
		}

		/**
		@name glow.events.removeListener 
		@function
		@description Removes a listener created with addListener

		@param {Number} ident An identifier returned from {@link glow.events.addListener}.
	
		@returns {Boolean}
		
		@example
			var listener = glow.events.addListener(...);
			glow.events.removeListener(listener);
		*/
		r.removeListener = function (ident) {
			if (ident && ident.toString().indexOf('k:') != -1) {
				return removeKeyListener(ident);
			}
			if (ident instanceof Array) {
				//call removeListener for each array member
				var i = ident.length; while(i--) {
					r.removeListener(ident[i]);
				}
				return true;
			}
			var listener = listenersByEventId[ident];
			if (! listener) { return false; }
			delete listenersByEventId[ident];
			var listeners = listenersByObjId[listener[0]][listener[1]];
			for (var i = 0, len = listeners.length; i < len; i++) {
				if (listeners[i] == listener) {
					listeners.splice(i, 1);
					break;
				}
			}
			if (! listeners.length) {
				delete listenersByObjId[listener[0]][listener[1]];
			}
			var listenersLeft = false;
			for (var i in listenersByObjId[listener[0]]) { listenersLeft = true; break;	}
			if (! listenersLeft) {
				delete listenersByObjId[listener[0]];
			}
			return true;
		};
		
		/**
		@name glow.events.removeAllListeners 
		@function
		@description Removes all listeners attached to a given object

		@param {String | glow.dom.NodeList | Object | Object[] } detachFrom The object(s) to remove listeners from.
		
			If the parameter is a string, then it is treated as a CSS selector,
			listeners are removed from all nodes.
		
		@returns glow.events
		
		@example
			glow.events.removeAllListeners("#myDiv");
		*/
		r.removeAllListeners = function(obj) {
			var i,
				objId,
				listenerIds = [],
				listenerIdsLen = 0,
				eventName,
				events;
			
			// cater for selector
			if (typeof obj == "string") {
				// get nodes
				obj = $(obj);
			}
			// cater for arrays & nodelists
			if (obj instanceof Array || obj instanceof glow.dom.NodeList) {
				//call removeAllListeners for each array member
				i = obj.length; while(i--) {
					r.removeAllListeners(obj[i]);
				}
				return r;
			}
			
			// get the objects id
			objId = obj[psuedoPrivateEventKey];
			
			// if it doesn't have an id it doesn't have events... return
			if (!objId) {
				return r;
			}
			events = listenersByObjId[objId];
			for (eventName in events) {
				i = events[eventName].length; while(i--) {
					listenerIds[listenerIdsLen++] = events[eventName][i][4];
				}
			}
			// remove listeners for that object
			if (listenerIds.length) {
				r.removeListener( listenerIds );
			}
			return r;
		}

		/**
		@name glow.events.fire
		@function
		@description Fires an event on an object.

		@param {Object} attachedTo The object that the event is associated with.
		
		@param {String} name The name of the event.
		
			Event names should not start with the word 'on'.
			
		@param {Object | glow.events.Event} [event] An event object or properties to add to a default event object
		
			If not specified, a generic event object is created. If you provide a simple
			object, a default Event will be created with the properties from the provided object.
	
		@returns {Object}
		
			The event object.
		
		@example
			// firing a custom event
			Ball.prototype.move = function () {
				// move the ball...
				// check its position
				if (this._height == 0) {
					var event = glow.events.fire(this, 'bounce', {
						bounceCount: this._bounceCount
					});
					
					// handle what to do if a listener returned false
					if ( event.defaultPrevented() ) {
						this.stopMoving();
					}
				}
			};
			
		@example
			// listening to a custom event
			var myBall = new Ball();
			
			glow.events.addListener(myBall, "bounce", function(event) {
				if (event.bounceCount == 3) {
					// stop bouncing after 3 bounces
					return false;
				}
			});
		*/
		r.fire = function (attachedTo, name, e) {
   			if (! attachedTo) throw 'glow.events.fire: required parameter attachedTo not passed (name: ' + name + ')';
   			if (! name) throw 'glow.events.fire: required parameter name not passed';
			if (! e) { e = new r.Event(); }
			if ( e.constructor === Object ) { e = new r.Event( e ) }

			if (typeof attachedTo == 'string') {
				if (! glow.dom) { throw "glow.dom must be loaded to use a selector as the first argument to glow.events.addListener"; }
				attachedTo = $(attachedTo);
			}

			e.type = name;
			e.attachedTo = attachedTo;
			if (! e.source) { e.source = attachedTo; }

			if (attachedTo instanceof glow.dom.NodeList) {

				attachedTo.each(function(i){

					callListeners(attachedTo[i], e);

				});

			} else {

				callListeners(attachedTo, e);

			}

			return e;
		};

		function callListeners(attachedTo, e) {
			
			var objIdent,
				objListeners,
				objEventListeners = objListeners && objListeners[e.type];

			// 3 assignments, but stop assigning if any of them are false
			(objIdent = attachedTo[psuedoPrivateEventKey]) &&
			(objListeners = listenersByObjId[objIdent]) &&
			(objEventListeners = objListeners[e.type]);

			if (! objEventListeners) { return e; }

			var listener;
			var listeners = objEventListeners.slice(0);

			// we make a copy of the listeners before calling them, as the event handlers may
			// remove themselves (took me a while to track this one down)
			for (var i = 0, len = listeners.length; i < len; i++) {
				listener = listeners[i];
				if ( listener[2].call(listener[3] || attachedTo, e) === false ) {
					e.preventDefault();
				}
			}

		}

		/**
		@private
		@name glow.events.addKeyListener
		@deprecated
		@function
		@description Adds an event listener for a keyboard event HELLO.
		
			<p><em>Notes for Opera</em></p>
			
			It is currently impossible to differentiate certain key events in 
			Opera (for example the RIGHT (the right arrow key) and the 
			apostrope (') result in the same code). For this reason pressing 
			either of these keys will result in key listeners specified as 
			"RIGHT" and/or "'" to be fired.
			
			<p><em>Key Identifiers</em></p>
			
			The key param uses the following strings to refer to special keys, 
			i.e. non alpha-numeric keys.
			
			<ul>
			<li>CAPSLOCK</li>
			<li>NUMLOCK</li>
			<li>SCROLLLOCK</li>
			<li>BREAK</li>
			<li>BACKTICK</li>
			<li>BACKSPACE</li>
			<li>PRINTSCREEN</li>
			<li>MENU</li>
			<li>SPACE</li>
			<li>ESC</li>
			<li>TAB</li>
			<li>META</li>
			<li>RIGHTMETA</li>
			<li>ENTER</li>
			<li>F1</li>
			<li>F2</li>
			<li>F3</li>
			<li>F4</li>
			<li>F5</li>
			<li>F6</li>
			<li>F7</li>
			<li>F8</li>
			<li>F9</li>
			<li>F10</li>
			<li>F11</li>
			<li>F12</li>
			<li>INS</li>
			<li>HOME</li>
			<li>PAGEUP</li>
			<li>DEL</li>
			<li>END</li>
			<li>PAGEDOWN</li>
			<li>LEFT</li>
			<li>UP</li>
			<li>RIGHT</li>
			<li>DOWN</li>
			</ul>

		@param {String} key The key or key combination to listen to. 
		
			This parameter starts with modifier keys 'CTRL', 'ALT' and 
			'SHIFT'. Modifiers can appear in any combination and order and are 
			separated by a '+'.
			
			Following any modifiers is the key character. To specify a 
			character code, use the appropriate escape sequence (e.g. 
			"CTRL+\u0065" = CTRL+e"). 
			
			To specify a special key, the key character should be replaced with 
			a key identifier, see description below (e.g. "RIGHT" specifies the 
			right arrow key).
			
		@param {String} type The type of key press to listen to.
			
			Possible values for this parameter are:
			
			<dl>
			<dt>press</dt><dd>the key is pressed (comparable to a mouse click)</dd>
			<dt>down</dt><dd>the key is pushed down</dd>
			<dt>up</dt><dd>the key is released</dd>
			</dl>
		
		@param {Function} callback The function to be called when the event fires.
			
		@param {Object} [context] The execution scope of the callback.
	
			If this parameter is not passed then the attachTo object will be the 
			context of the callback.
	
		@returns {Number}
		
			A unique identifier for the event suitable for passing to 
			{@link glow.events.removeListener}.
		
		@example
			glow.events.addKeyListener("CTRL+ALT+a", "press",
		        function () { alert("CTRL+ALT+a pressed"); }
		    );
			glow.events.addKeyListener("SHIFT+\u00A9", "down",
				function () { alert("SHIFT+© pushed") }
			);
		*/
		var keyRegex = /^((?:(?:ctrl|alt|shift)\+)*)(?:(\w+|.)|[\n\r])$/i;
		r.addKeyListener = function (key, type, callback, context) {
			type.replace(/^key/i, "");
			type = type.toLowerCase();
			if (! (type == 'press' || type == 'down' || type == 'up')) {
				throw 'event type must be press, down or up';
			}
			if (! topKeyListeners[type]) { initTopKeyListener(type); }
			var res = key.match(keyRegex),
				mods = 0,
				charCode;
			if (! res) { throw 'key format not recognised'; }
			if (res[1].toLowerCase().indexOf('ctrl') != -1)  { mods += CTRL;  }
			if (res[1].toLowerCase().indexOf('alt') != -1)   { mods += ALT;   }
			if (res[1].toLowerCase().indexOf('shift') != -1) { mods += SHIFT; }
			var eventKey = mods + ':' + (res[2] ? res[2].toLowerCase() : '\n') + ':' + type;
			var ident = 'k:' + keyListenerId++;
			keyTypes[ident] = eventKey;
			var listeners = keyListeners[eventKey];
			if (! listeners) { listeners = keyListeners[eventKey] = []; }
			listeners[listeners.length] = [ident, type, callback, context];
			return ident;
		};

		/**
		@name  glow.events.Event
		@class
		@param {Object} [properties] Properties to add to the Event instance.
			Each key-value pair in the object will be added to the Event as
			properties
		@description Object passed into all events
			
			Some of the properties described below are only available for 
			certain event types. These are listed in the property descriptions 
			where applicable.
			
			<p><em>Notes for Opera</em></p>
			
			The information returned from Opera about key events does not allow 
			certain keys to be differentiated. This mainly applies to special 
			keys, such as the arrow keys, function keys, etc. which conflict 
			with some printable characters.
			
		*/
		r.Event = function ( obj ) {
			if( obj ) {
				glow.lang.apply( this, obj );
			}
		};
		
		/**
		@name glow.events.Event#attachedTo
		@type Object | Element
		@description The object/element that the listener is attached to.
		
			See the description for 'source' for more details.
		*/
		
		/**
		@name glow.events.Event#source
		@type Element
		@description The actual object/element that the event originated from.
			
			For example, you could attach a listener to an 'ol' element to 
			listen for clicks. If the user clicked on an 'li' the source property 
			would be the 'li' element, and 'attachedTo' would be the 'ol'.
		*/
		
		/**
		@name glow.events.Event#pageX
		@type Number
		@description The horizontal position of the mouse pointer in the page in pixels.
		
			<p><em>Only available for mouse events.</em></p>
		*/
		
		/**
		@name glow.events.Event#pageY
		@type Number
		@description The vertical position of the mouse pointer in the page in pixels.
		
			<p><em>Only available for mouse events.</em></p>
		*/
		
		/**
		@name glow.events.Event#button
		@type Number
		@description  A number representing which button was pressed.
		
			<p><em>Only available for mouse events.</em></p>
			
			0 for the left button, 1 for the middle button or 2 for the right button.
		*/

		/**
		@name glow.events.Event#relatedTarget
		@type Element
		@description The element that the mouse has come from or is going to.
		
			<p><em>Only available for mouse over/out events.</em></p>
		*/
		
		/**
		@name glow.events.Event#wheelDelta
		@type Number
		@description The number of clicks up (positive) or down (negative) that the user moved the wheel.
		
			<p><em>Only available for mouse wheel events.</em></p>
		*/
		
		/**
		@name glow.events.Event#ctrlKey
		@type Boolean
		@description Whether the ctrl key was pressed during the key event.
		
			<p><em>Only available for keyboard events.</em></p>
		*/
		
		/**
		@name glow.events.Event#shiftKey
		@type Boolean
		@description  Whether the shift key was pressed during the key event.
		
			<p><em>Only available for keyboard events.</em></p>
		*/
		
		/**
		@name glow.events.Event#altKey
		@type Boolean
		@description Whether the alt key was pressed during the key event.
		
			<p><em>Only available for keyboard events.</em></p>
		*/
		
		/**
		@name glow.events.Event#capsLock 			
		@type Boolean | Undefined
		@description Whether caps-lock was on during the key event
		
			<p><em>Only available for keyboard events.</em></p>
		
			If the key is not alphabetic, this property will be undefined 
			as it is not possible to tell if caps-lock is on in this scenario.
		*/
		
		/**
		@name glow.events.Event#keyCode
		@type Number
		@description An integer number represention of the keyboard key that was pressed.
		
			<p><em>Only available for keyboard events.</em></p>
		*/
		
		/**
		@name glow.events.Event#key
		@type String | Undefined
		@description  A short identifier for the key for special keys.
		
			<p><em>Only available for keyboard events.</em></p>
			
			If the key was not a special key this property will be undefined.
			
			See the list of key identifiers in {@link glow.events.addKeyListener}
		*/
		
		/**
		@name glow.events.Event#charCode
		@type Number | Undefined
		@description The unicode character code for a printable character.
		
			<p><em>Only available for keyboard events.</em></p>
			
			This will be undefined if the key was not a printable character.
		*/
		
		/**
		@name glow.events.Event#chr
		@type String
		@description A printable character string.
		
			<p><em>Only available for keyboard events.</em></p>
			
			The string of the key that was pressed, for example 'j' or 's'.
			
			This will be undefined if the key was not a printable character.
		*/
		

		/**
		@name glow.events.Event#preventDefault
		@function
		@description Prevent the default action for events. 
		
			This can also be achieved by returning false from an event callback
		
		*/
		r.Event.prototype.preventDefault = function () {
			if (this[psuedoPreventDefaultKey]) { return; }
			this[psuedoPreventDefaultKey] = true;
			if (this.nativeEvent && this.nativeEvent.preventDefault) {
				this.nativeEvent.preventDefault();
				this.nativeEvent.returnValue = false;
			}
		};

		/**
		@name glow.events.Event#defaultPrevented
		@function
		@description Test if the default action has been prevented.
		
		@returns {Boolean}
		
			True if the default action has been prevented.
		*/
		r.Event.prototype.defaultPrevented = function () {
			return !! this[psuedoPreventDefaultKey];
		};

		/**
		@name glow.events.Event#stopPropagation
		@function
		@description Stops the event propagating. 
		
			For DOM events, this stops the event bubbling up through event 
			listeners added to parent elements. The event object is marked as
			having had propagation stopped (see 
			{@link glow.events.Event#propagationStopped propagationStopped}).
		
		@example
			// catch all click events that are not links
			glow.events.addListener(
				document,
				'click',
				function () { alert('document clicked'); }
			);

			glow.events.addListener(
				'a',
				'click',
				function (e) { e.stopPropagation(); }
			);
		*/
		r.Event.prototype.stopPropagation = function () {
			if (this[psuedoStopPropagationKey]) { return; }
			this[psuedoStopPropagationKey] = true;
			var e = this.nativeEvent;
			if (e) {
				e.cancelBubble = true;
				if (e.stopPropagation) { e.stopPropagation(); }
			}
		};

		/**
		@name glow.events.Event#propagationStopped
		@function
		@description Tests if propagation has been stopped for this event.
		
		@returns {Boolean}
		
			True if event propagation has been prevented.

		*/
		r.Event.prototype.propagationStopped = function () {
			return !! this[psuedoStopPropagationKey];
		};
		
		//cleanup to avoid mem leaks in IE
		if (glow.env.ie < 8 || glow.env.webkit < 500) {
			r.addListener(window, "unload", clearEvents);
		}

		glow.events = r;
		glow.events.listenersByObjId = listenersByObjId;
	}
});/**
@name glow.data
@namespace
@description Serialising and de-serialising data
@see <a href="../furtherinfo/data/data.shtml">Using glow.data</a>
*/
(window.gloader || glow).module({
	name: "glow.data",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", "glow.dom"]],
	builder: function(glow) {
		//private

		/*
		PrivateProperty: TYPES
			hash of strings representing data types
		*/
		var TYPES = {
			UNDEFINED : "undefined",
			OBJECT    : "object",
			NUMBER    : "number",
			BOOLEAN   : "boolean",
			STRING    : "string",
			ARRAY     : "array",
			FUNCTION  : "function",
			NULL      : "null"
		}

		/*
		PrivateProperty: TEXT
			hash of strings used in encoding/decoding
		*/
		var TEXT = {
			AT    : "@",
			EQ    : "=",
			DOT   : ".",
			EMPTY : "",
			AND   : "&",
			OPEN  : "(",
			CLOSE : ")"
		}

		/*
		PrivateProperty: JSON
			nested hash of strings and regular expressions used in encoding/decoding Json
		*/
		var JSON = {
			HASH : {
				START     : "{",
				END       : "}",
				SHOW_KEYS : true
			},

			ARRAY : {
				START     : "[",
				END       : "]",
				SHOW_KEYS : false
			},

			DATA_SEPARATOR   : ",",
			KEY_SEPARATOR    : ":",
			KEY_DELIMITER    : "\"",
			STRING_DELIMITER : "\"",

			SAFE_PT1 : /^[\],:{}\s]*$/,
			SAFE_PT2 : /\\./g,
			SAFE_PT3 : /\"[^\"\\\n\r]*\"|true|false|null|-?\d+(?:\.\d*)?(:?[eE][+\-]?\d+)?/g,
			SAFE_PT4 : /(?:^|:|,)(?:\s*\[)+/g
		}

		/*
		PrivateProperty: SLASHES
			hash of strings and regular expressions used in encoding strings
		*/
		var SLASHES = {
			TEST : /[\b\n\r\t\\\f\"]/g,
			B : {PLAIN : "\b", ESC : "\\b"},
			N : {PLAIN : "\n", ESC : "\\n"},
			R : {PLAIN : "\r", ESC : "\\r"},
			T : {PLAIN : "\t", ESC : "\\t"},
			F : {PLAIN : "\f", ESC : "\\f"},
			SL : {PLAIN : "\\", ESC : "\\\\"},
			QU : {PLAIN : "\"", ESC : "\\\""}
		}

		/*
		PrivateMethod: _replaceSlashes
			Callback function for glow.lang.replace to escape appropriate characters

		Arguments:
			s - the regex match to be tested

		Returns:
			The escaped version of the input.
		*/
		function _replaceSlashes(s) {
			switch (s) {
				case SLASHES.B.PLAIN: return SLASHES.B.ESC;
				case SLASHES.N.PLAIN: return SLASHES.N.ESC;
				case SLASHES.R.PLAIN: return SLASHES.R.ESC;
				case SLASHES.T.PLAIN: return SLASHES.T.ESC;
				case SLASHES.F.PLAIN: return SLASHES.F.ESC;
				case SLASHES.SL.PLAIN: return SLASHES.SL.ESC;
				case SLASHES.QU.PLAIN: return SLASHES.QU.ESC;
				default: return s;
			}
		}

		/*
		PrivateMethod: _getType
			Returns the data type of the object

		Arguments:
			object - the object to be tested

		Returns:
			A one of the TYPES constant properties that represents the data type of the object.
		*/
		function _getType(object) {
			if((typeof object) == TYPES.OBJECT) {
				if (object == null) {
					return TYPES.NULL;
				} else {
					return (object instanceof Array)?TYPES.ARRAY:TYPES.OBJECT;
				}
			} else {
				return (typeof object);
			}
		}

		//public
		glow.data = {
			/**
			@name glow.data.encodeUrl
			@function
			@description Encodes an object for use as a query string.
			
				Returns a string representing the object suitable for use 
				as a query string, with all values suitably escaped.
				It does not include the initial question mark. Where the 
				input field was an array, the key is repeated in the output.
			
			@param {Object} object The object to be encoded.
			
				This must be a hash whose values can only be primitives or 
				arrays of primitives.
			
			@returns {String}
			
			@example
				var getRef = glow.data.encodeUrl({foo: "Foo", bar: ["Bar 1", "Bar2"]});
				// will return "foo=Foo&bar=Bar%201&bar=Bar2"
			*/
			encodeUrl : function (object) {
				var objectType = _getType(object);
				var paramsList = [];
				var listLength = 0;

				if (objectType != TYPES.OBJECT) {
					throw new Error("glow.data.encodeUrl: cannot encode item");
				} else {
					for (var key in object) {
						switch(_getType(object[key])) {
							case TYPES.FUNCTION:
							case TYPES.OBJECT:
								throw new Error("glow.data.encodeUrl: cannot encode item");
								break;
							case TYPES.ARRAY:
								for(var i = 0, l = object[key].length; i < l; i++) {
									switch(_getType(object[key])[i]) {
										case TYPES.FUNCTION:
										case TYPES.OBJECT:
										case TYPES.ARRAY:
											throw new Error("glow.data.encodeUrl: cannot encode item");
											break;
										default:
											paramsList[listLength++] = key + TEXT.EQ + encodeURIComponent(object[key][i]);
									}
								}
								break;
							default:
								paramsList[listLength++] = key + TEXT.EQ + encodeURIComponent(object[key]);
						}
					}

					return paramsList.join(TEXT.AND);
				}
			},
			/**
			@name glow.data.decodeUrl
			@function
			@description Decodes a query string into an object.
			
				Returns an object representing the data given by the query 
				string, with all values suitably unescaped. All keys in the 
				query string are keys of the object. Repeated keys result 
				in an array.
			
			@param {String} string The query string to be decoded.
			
				It should not include the initial question mark.
			
			@returns {Object}
			
			@example
				var getRef = glow.data.decodeUrl("foo=Foo&bar=Bar%201&bar=Bar2");
				// will return the object {foo: "Foo", bar: ["Bar 1", "Bar2"]}
			*/
			decodeUrl : function (text) {
				if(_getType(text) != TYPES.STRING) {
					throw new Error("glow.data.decodeUrl: cannot decode item");
				} else if (text === "") {
					return {};
				}

				var result = {};
				var keyValues = text.split(/[&;]/);

				var thisPair, key, value;

				for(var i = 0, l = keyValues.length; i < l; i++) {
					thisPair = keyValues[i].split(TEXT.EQ);
					if(thisPair.length != 2) {
						throw new Error("glow.data.decodeUrl: cannot decode item");
					} else {
						key   = glow.lang.trim( decodeURIComponent(thisPair[0]) );
						value = glow.lang.trim( decodeURIComponent(thisPair[1]) );

						switch (_getType(result[key])) {
							case TYPES.ARRAY:
								result[key][result[key].length] = value;
								break;
							case TYPES.UNDEFINED:
								result[key] = value;
								break;
							default:
								result[key] = [result[key], value];
						}
					}
				}

				return result;
			},
			/**
			@name glow.data.encodeJson
			@function
			@description Encodes an object into a string JSON representation.
			
				Returns a string representing the object as JSON.
			
			@param {Object} object The object to be encoded.
			 
				This can be arbitrarily nested, but must not contain 
				functions or cyclical structures.
			
			@returns {Object}
			
			@example
				var myObj = {foo: "Foo", bar: ["Bar 1", "Bar2"]};
				var getRef = glow.data.encodeJson(myObj);
				// will return '{"foo": "Foo", "bar": ["Bar 1", "Bar2"]}'
			*/
			encodeJson : function (object, options) {
				function _encode(object, options)
				{
					if(_getType(object) == TYPES.ARRAY) {
						var type = JSON.ARRAY;
					} else {
						var type = JSON.HASH;
					}

					var serial = [type.START];
					var len = 1;
					var dataType;
					var notFirst = false;

					for(var key in object) {
						dataType = _getType(object[key]);

						if(dataType != TYPES.UNDEFINED) { /* ignore undefined data */
							if(notFirst) {
								serial[len++] = JSON.DATA_SEPARATOR;
							}
							notFirst = true;

							if(type.SHOW_KEYS) {
								serial[len++] = JSON.KEY_DELIMITER;
								serial[len++] = key;
								serial[len++] = JSON.KEY_DELIMITER;
								serial[len++] = JSON.KEY_SEPARATOR;
							}

							switch(dataType) {
								case TYPES.FUNCTION:
									throw new Error("glow.data.encodeJson: cannot encode item");
									break;
								case TYPES.STRING:
								default:
									serial[len++] = JSON.STRING_DELIMITER;
									serial[len++] = glow.lang.replace(object[key], SLASHES.TEST, _replaceSlashes);
									serial[len++] = JSON.STRING_DELIMITER;
									break;
								case TYPES.NUMBER:
								case TYPES.BOOLEAN:
									serial[len++] = object[key];
									break;
								case TYPES.OBJECT:
								case TYPES.ARRAY:
									serial[len++] = _encode(object[key], options);
									break;
								case TYPES.NULL:
									serial[len++] = TYPES.NULL;
									break;
							}
						}
					}
					serial[len++] = type.END;

					return serial.join(TEXT.EMPTY);
				}

				options = options || {};
				var type = _getType(object);

				if((type == TYPES.OBJECT) || (type == TYPES.ARRAY)) {
					return _encode(object, options);
				} else {
					throw new Error("glow.data.encodeJson: cannot encode item");
				}
			},
			/**
			@name glow.data.decodeJson
			@function
			@description Decodes a string JSON representation into an object.
				
				Returns a JavaScript object that mirrors the data given.
			
			@param {String} string The string to be decoded.
				Must be valid JSON. 
			
			@param {Object} opts
			
					Zero or more of the following as properties of an object:
					@param {Boolean} [opts.safeMode=false] Whether the string should only be decoded if it is  deemed "safe". 
					The json.org regular expression checks are used. 
			
			@returns {Object}
			
			@example
				var getRef = glow.data.decodeJson('{foo: "Foo", bar: ["Bar 1", "Bar2"]}');
				// will return {foo: "Foo", bar: ["Bar 1", "Bar2"]}
			
				var getRef = glow.data.decodeJson('foobar', {safeMode: true});
				// will throw an error
			*/
			decodeJson : function (text, options) {
				if(_getType(text) != TYPES.STRING) {
					throw new Error("glow.data.decodeJson: cannot decode item");
				}

				options = options || {};
				options.safeMode = options.safeMode || false;

				var canEval = true;

				if(options.safeMode) {
					canEval = (JSON.SAFE_PT1.test(text.replace(JSON.SAFE_PT2, TEXT.AT).replace(JSON.SAFE_PT3, JSON.ARRAY.END).replace(JSON.SAFE_PT4, TEXT.EMPTY)));
				}

				if(canEval) {
					try {
						return eval(TEXT.OPEN + text + TEXT.CLOSE);
					}
					catch(e) {/* continue to error */}
				}

				throw new Error("glow.data.decodeJson: cannot decode item");
			},
			/**
			@name glow.data.escapeHTML
			@function
			@description Escape HTML entities.
			
				Returns a string with HTML entities escaped.
			
			@param {String} string The string to be escaped.
			
			@returns {String}
			
			@example
				// useful for protecting against XSS attacks:
				var fieldName = '" onclick="alert(\'hacked\')" name="';
			
				// but should be used in all cases like this:
				glow.dom.create('<input name="' + glow.data.escapeHTML(untrustedString) + '"/>');
			 */
			escapeHTML : function (html) {
				return glow.dom.create('<div></div>').text(html).html();
			}		   
		};
	}
});
/**
@name glow.net
@namespace
@description Sending data to & from the server
@see <a href="../furtherinfo/net/net.shtml">Using glow.net</a>
*/
(window.gloader || glow).module({
	name: "glow.net",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", "glow.data", "glow.events"]],
	builder: function(glow) {
		//private

		var STR = {
				XML_ERR:"Cannot get response as XML, check the mime type of the data",
				POST_DEFAULT_CONTENT_TYPE:'application/x-www-form-urlencoded;'
			},
			endsPlusXml = /\+xml$/,
			/**
			 * @name glow.net.scriptElements
			 * @private
			 * @description Script elements that have been added via {@link glow.net.loadScript loadScript}
			 * @type Array
			 */
			scriptElements = [],
			/**
			 * @name glow.net.callbackPrefix
			 * @private
			 * @description Callbacks in _jsonCbs will be named this + a number
			 * @type String
			 */
			callbackPrefix = "c",
			/**
			 * @name glow.net.globalObjectName
			 * @private
			 * @description Name of the global object used to store loadScript callbacks
			 * @type String
			 */
			globalObjectName = "_" + glow.UID + "loadScriptCbs",
			$ = glow.dom.get,
			events = glow.events,
			emptyFunc = function(){};

		/**
		 * @name glow.net.xmlHTTPRequest
		 * @private
		 * @function
		 * @description Creates an xmlHTTPRequest transport
		 * @returns Object
		 */
		function xmlHTTPRequest() {
			//try IE first. IE7's xmlhttprequest and XMLHTTP6 are broken. Avoid avoid avoid!
			if (window.ActiveXObject) {
				return (xmlHTTPRequest = function() { return new ActiveXObject("Microsoft.XMLHTTP"); })();
			} else {
				return (xmlHTTPRequest = function() { return new XMLHttpRequest(); })();
			}
		}

		/**
		 * @name glow.net.populateOptions
		 * @private
		 * @function
		 * @description Adds defaults to get / post option object
		 * @param {Object} opts Object to add defaults to
		 * @returns Object
		 */
		function populateOptions(opts) {
			return glow.lang.apply(
				{
					onLoad: emptyFunc,
					onError: emptyFunc,
					onAbort: emptyFunc,
					headers: {},
					async: true,
					useCache: false,
					data: null,
					defer: false,
					forceXml: false
				},
				opts || {}
			);
		}

		/*
		PrivateMethod: noCacheUrl
			Adds random numbers to the querystring of a url so the browser doesn't use a cached version
		*/

		function noCacheUrl(url) {
			return [url, (/\?/.test(url) ? "&" : "?"), "a", new Date().getTime(), parseInt(Math.random()*100000)].join("");
		}

		/*
		PrivateMethod: makeXhrRequest
			Makes an http request
		*/
		/**
		 * @name glow.net.makeXhrRequest
		 * @private
		 * @function
		 * @description Makes an xhr http request
		 * @param {String} method HTTP Method
		 * @param {String} url URL of the request
		 * @param {Object} Options, see options for {@link glow.net.get}
		 * @returns Object
		 */
		function makeXhrRequest(method, url, opts) {
			var req = xmlHTTPRequest(), //request object
				data = opts.data && (typeof opts.data == "string" ? opts.data : glow.data.encodeUrl(opts.data)),
				i,
				request = new Request(req, opts);

			if (!opts.useCache) {
				url = noCacheUrl(url);
			}

			//open needs to go first to maintain cross-browser support for readystates
			req.open(method, url, opts.async);

			//add custom headers
			for (i in opts.headers) {
				req.setRequestHeader(i, opts.headers[i]);
			}

			function send() {
				request.send = emptyFunc;
				if (opts.async) {
					//sort out the timeout if there is one
					if (opts.timeout) {
						request._timeout = setTimeout(function() {
							abortRequest(request);
							var response = new Response(req, true, request);
							events.fire(request, "error", response);
						}, opts.timeout * 1000);
					}

					req.onreadystatechange = function() {
						if (req.readyState == 4) {
							//clear the timeout
							request._timeout && clearTimeout(request._timeout);
							//set as completed
							request.completed = true;
							var response = new Response(req, false, request);
							if (response.wasSuccessful) {
								events.fire(request, "load", response);
							} else {
								events.fire(request, "error", response);
							}
							// prevent parent scopes leaking (cross-page) in IE
							req.onreadystatechange = new Function();
						}
					};
					req.send(data);
					return request;
				} else {
					req.send(data);
					request.completed = true;
					var response = new Response(req, false, request);
					if (response.wasSuccessful) {
						events.fire(request, "load", response);
					} else {
						events.fire(request, "error", response);
					}
					return response;
				}
			}

			request.send = send;
			return opts.defer ? request : send();
		}

		//public
		var r = {}; //the module

		/**
		@name glow.net.get
		@function
		@description Makes an HTTP GET request to a given url

		@param {String} url
			Url to make the request to. This can be a relative path. You cannot make requests
			for files on other domains, to do that you must put your data in a javascript
			file and use {@link glow.net.loadScript} to fetch it.
		@param {Object} opts
			Options Object of options.
			@param {Function} [opts.onLoad] Callback to execute when the request has sucessfully loaded
				The callback is passed a Response object as its first parameter.
			@param {Function} [opts.onError] Callback to execute if the request was unsucessful
				The callback is passed a Response object as its first parameter.
				This callback will also be run if a request times out.
			@param {Function} [opts.onAbort] Callback to execute if the request is aborted
			@param {Object} [opts.headers] A hash of headers to send along with the request
				Eg {"Accept-Language": "en-gb"}
			@param {Boolean} [opts.async=true] Should the request be performed asynchronously?
			@param {Boolean} [opts.useCache=false] Allow a cached response
				If false, a random number is added to the query string to ensure a fresh version of the file is being fetched
			@param {Number} [opts.timeout] Time to allow for the request in seconds
				No timeout is set by default. Only applies for async requests. Once
				the time is reached, the error event will fire with a "408" status code.
			@param {Boolean} [opts.defer=false] Do not send the request straight away
				Deferred requests need to be triggered later using myRequest.send()
			@param {Boolean} [opts.forceXml=false] Treat the response as XML.
				This will allow you to use {@link glow.net.Response#xml response.xml()}
				even if the response has a non-XML mime type.

		@returns {glow.net.Request|glow.net.Response}
			A response object for non-defered sync requests, otherwise a
			request object is returned

		@example
			var request = glow.net.get("myFile.html", {
				onLoad: function(response) {
					alert("Got file:\n\n" + response.text());
				},
				onError: function(response) {
					alert("Error getting file: " + response.statusText());
				}
			});
		*/
		r.get = function(url, o) {
			o = populateOptions(o);
			return makeXhrRequest('GET', url, o);
		};

		/**
		@name glow.net.post
		@function
		@description Makes an HTTP POST request to a given url

		@param {String} url
			Url to make the request to. This can be a relative path. You cannot make requests
			for files on other domains, to do that you must put your data in a javascript
			file and use {@link glow.net.loadScript} to fetch it.
		@param {Object|String} data
			Data to post, either as a JSON-style object or a urlEncoded string
		@param {Object} opts
			Same options as {@link glow.net.get}

		@returns {Number|glow.net.Response}
			An integer identifying the async request, or the response object for sync requests

		@example
			var postRef = glow.net.post("myFile.html",
				{key:"value", otherkey:["value1", "value2"]},
				{
					onLoad: function(response) {
						alert("Got file:\n\n" + response.text());
					},
					onError: function(response) {
						alert("Error getting file: " + response.statusText());
					}
				}
			);
		*/
		r.post = function(url, data, o) {
			o = populateOptions(o);
			o.data = data;
			if (!o.headers["Content-Type"]) {
				o.headers["Content-Type"] = STR.POST_DEFAULT_CONTENT_TYPE;
			}
			return makeXhrRequest('POST', url, o);
		};

		/**
		@name glow.net.loadScript
		@function
		@description Loads data by adding a script element to the end of the page
			This can be used cross domain, but should only be used with trusted
			sources as any javascript included in the script will be executed.

		@param {String} url
			Url of the script. Use "{callback}" in the querystring as the callback
			name if the data source supports it, then you can use the options below
		@param {Object} [opts]
			An object of options to use if "{callback}" is specified in the url.
			@param {Function} [opts.onLoad] Called when loadScript succeeds.
				The parameters are passed in by the external data source
			@param {Function} [opts.onError] Called on timeout
				No parameters are passed
			@param {Function} [opts.onAbort] Called if the request is aborted
			@param {Boolean} [opts.useCache=false] Allow a cached response
			@param {Number} [opts.timeout] Time to allow for the request in seconds
			@param {String} [opts.charset] Charset attribute value for the script

		@returns {glow.net.Request}

		@example
			glow.net.loadScript("http://www.server.com/json/tvshows.php?jsoncallback={callback}", {
				onLoad: function(data) {
					alert("Data loaded");
				}
			});
		*/
		r.loadScript = function(url, opts) {
			//id of the request
			var newIndex = scriptElements.length,
				//script element that gets inserted on the page
				script,
				//generated name of the callback, may not be used
				callbackName = callbackPrefix + newIndex,
				opts = populateOptions(opts),
				request = new Request(newIndex, opts),
				url = opts.useCache ? url : noCacheUrl(url),
				//the global property used to hide callbacks
				globalObject = window[globalObjectName] || (window[globalObjectName] = {});

			//assign onload
			if (opts.onLoad != emptyFunc) {
				globalObject[callbackName] = function() {
					//clear the timeout
					request._timeout && clearTimeout(request._timeout);
					//set as completed
					request.completed = true;
					// call the user's callback
					opts.onLoad.apply(this, arguments);
					// cleanup references to prevent leaks
					request.destroy();
					script = globalObject[callbackName] = undefined;
					delete globalObject[callbackName];
				};
				url = glow.lang.interpolate(url, {callback: globalObjectName + "." + callbackName});
			}

			script = scriptElements[newIndex] = document.createElement("script");

			if (opts.charset) {
				script.charset = opts.charset;
			}

			//add abort event
			events.addListener(request, "abort", opts.onAbort);

			glow.ready(function() {
				//sort out the timeout
				if (opts.timeout) {
					request._timeout = setTimeout(function() {
						abortRequest(request);
						opts.onError();
					}, opts.timeout * 1000);
				}
				//using setTimeout to stop Opera 9.0 - 9.26 from running the loaded script before other code
				//in the current script block
				if (glow.env.opera) {
					setTimeout(function() {
						if (script) { //script may have been removed already
							script.src = url;
						}
					}, 0);
				} else {
					script.src = url;
				}
				//add script to page
				document.body.appendChild(script);
			});

			return request;
		}

		/**
		 *	@name glow.net.abortRequest
		 *	@private
		 *	@function
		 *	@description Aborts the request
		 *		Doesn't trigger any events
		 *
		 *	@param {glow.net.Request} req Request Object
		 *	@returns this
		 */
		function abortRequest(req) {
			var nativeReq = req.nativeRequest,
				callbackIndex = req._callbackIndex;

			//clear timeout
			req._timeout && clearTimeout(req._timeout);
			//different if request came from loadScript
			if (nativeReq) {
				//clear listeners
				// prevent parent scopes leaking (cross-page) in IE
				nativeReq.onreadystatechange = new Function();
				nativeReq.abort();
			} else if (callbackIndex) {
				//clear callback
				window[globalObjectName][callbackPrefix + callbackIndex] = emptyFunc;
				//remove script element
				glow.dom.get(scriptElements[callbackIndex]).destroy();
			}
		}

		/**
		 * @name glow.net.Request
		 * @class
		 * @description Returned by {@link glow.net.post post}, {@link glow.net.get get} async requests and {@link glow.net.loadScript loadScript}
		 * @glowPrivateConstructor There is no direct constructor, since {@link glow.net.post post} and {@link glow.net.get get} create the instances.
		 */
		 
		/**
		 * @name glow.net.Request#event:load
		 * @event
		 * @param {glow.events.Event} event Event Object
		 * @description Fired when the request is sucessful
		 *   For a get / post request, this will be fired when request returns
		 *   with an HTTP code of 2xx. loadScript requests will fire 'load' only
		 *   if {callback} is used in the URL.
		 */
		 
		/**
		 * @name glow.net.Request#event:abort
		 * @event
		 * @param {glow.events.Event} event Event Object
		 * @description Fired when the request is aborted
		 *   If you cancel the default (eg, by returning false) the request
		 *   will continue.
		 * @description Returned by {@link glow.net.post glow.net.post}, {@link glow.net.get glow.net.get} async requests and {@link glow.net.loadScript glow.net.loadScript}
		 * @see <a href="../furtherinfo/net/net.shtml">Using glow.net</a>
		 * @glowPrivateConstructor There is no direct constructor, since {@link glow.net.post glow.net.post} and {@link glow.net.get glow.net.get} create the instances.
		 */
		 
		/**
		 * @name glow.net.Request#event:error
		 * @event
		 * @param {glow.events.Event} event Event Object
		 * @description Fired when the request is unsucessful
		 *   For a get/post request, this will be fired when request returns
		 *   with an HTTP code which isn't 2xx or the request times out. loadScript
		 *   calls will fire 'error' only if the request times out.
		 */
		 
		 
		/*
		 We don't want users to create instances of this class, so the constructor is documented
		 out of view of jsdoc

		 @param {Object} requestObj
			Object which represents the request type.
			For XHR requests it should be an XmlHttpRequest object, for loadScript
			requests it should be a number, the Index of the callback in glow.net._jsonCbs
		 @param {Object} opts
			Zero or more of the following as properties of an object:
			@param {Function} [opts.onLoad] Called when the request is sucessful
			@param {Function} [opts.onError] Called when a request is unsucessful
			@param {Function} [opts.onAbort] Called when a request is aborted

		*/
		function Request(requestObj, opts) {
			/**
			 * @name glow.net.Request#_timeout
			 * @private
			 * @description timeout ID. This is set by makeXhrRequest or loadScript
			 * @type Number
			 */
			this._timeout = null;
			
			/*
			 @name glow.net.Request#_forceXml
			 @private
			 @type Boolean
			 @description Force the response to be treated as xml
			*/
			this._forceXml = opts.forceXml;
			
			// force the reponse to be treated as xml
			// IE doesn't support overrideMineType, we need to deal with that in {@link glow.net.Response#xml}
			if (opts.forceXml && requestObj.overrideMimeType) {
				requestObj.overrideMimeType('application/xml');
			}
			
			/**
			 * @name glow.net.Request#complete
			 * @description Boolean indicating whether the request has completed
			 * @example
				// request.complete with an asynchronous call
				var request = glow.net.get(
					"myFile.html", 
					{
						async: true,
						onload: function(response) {
							alert(request.complete); // returns true
						}
					}
				);
				alert(request.complete); // returns boolean depending on timing of asynchronous call

				// request.complete with a synchronous call
				var request = glow.net.get("myFile.html", {async: false;});
				alert(request.complete); // returns true
			 * @type Boolean
			 */
			this.complete = false;

			if (typeof requestObj == "number") {
				/**
				 * @name glow.net.Request#_callbackIndex
				 * @private
				 * @description Index of the callback in glow.net._jsonCbs
				 *   This is only relavent for requests made via loadscript using the
				 *   {callback} placeholder
				 * @type Number
				 */
				this._callbackIndex = requestObj;
			} else {
				/**
				 * @name glow.net.Request#nativeRequest
				 * @description The request object from the browser.
				 *   This may not have the same properties and methods across user agents.
				 *   Also, this will be undefined if the request originated from loadScript.
				 * @example
				var request = glow.net.get(
					"myFile.html", 
					{
						async: true,
						onload: function(response) {
							alert(request.NativeObject); // returns Object()
						}
					}
				);
				 * @type Object
				 */
				this.nativeRequest = requestObj;
			}

			//assign events
			var eventNames = ["Load", "Error", "Abort"], i=0;

			for (; i < 3; i++) {
				events.addListener(this, eventNames[i].toLowerCase(), opts["on" + eventNames[i]]);
			}

		}
		Request.prototype = {
			/**
			@name glow.net.Request#send
			@function
			@description Sends the request.
				This is done automatically unless the defer option is set
			@example
				var request = glow.net.get(
					"myFile.html", 
					{
						onload : function(response) {alert("Loaded");},
						defer: true
					}
				);
				request.send(); // returns "Loaded"
			@returns {Object}
				This for async requests or a response object for sync requests
			*/
			//this function is assigned by makeXhrRequest
			send: function() {},
			/**
			 *	@name glow.net.Request#abort
			 *	@function
			 *	@description Aborts an async request
			 *		The load & error events will not fire. If the request has been
			 *		made using {@link glow.net.loadScript loadScript}, the script
			 *		may still be loaded but	the callback will not be fired.
			 * @example
				var request = glow.net.get(
					"myFile.html", 
					{
						async: true,
						defer: true,
						onabort: function() {
							alert("Something bad happened.  The request was aborted.");
						}
					}
				);
				request.abort(); // returns "Something bad happened.  The request was aborted"
			 *	@returns this
			 */
			abort: function() {
				if (!this.completed && !events.fire(this, "abort").defaultPrevented()) {
					abortRequest(this);
				}
				return this;
			},
			/**
			 @name glow.net.Request#destroy
			 @function
			 @description Release memory from a {@link glow.net.loadScript} call.
				
				This is called automatically by {@link glow.net.loadScript loadScript}
				calls that have {callback} in the URL. However, if you are not using
				{callback}, you can use this method manually to release memory when
				the request has finished.
			 
			 @example
				var request = glow.net.loadScript('http://www.bbc.co.uk/whatever.js');
			
			 @returns this
			*/
			destroy: function() {
				if (this._callbackIndex !== undefined) {
					// set timeout is used here to prevent a crash in IE7 (possibly other version) when the script is from the filesystem
					setTimeout(function() {
						$( scriptElements[this._callbackIndex] ).destroy();
						scriptElements[this._callbackIndex] = undefined;
						delete scriptElements[this._callbackIndex];
					}, 0);
				}
				return this;
			}
		};

		/**
		@name glow.net.Response
		@class
		@description Provided in callbacks to {@link glow.net.post glow.net.post} and {@link glow.net.get glow.net.get}
		@see <a href="../furtherinfo/net/net.shtml">Using glow.net</a>

		@glowPrivateConstructor There is no direct constructor, since {@link glow.net.post glow.net.post} and {@link glow.net.get glow.net.get} create the instances.
		*/
		/*
		 These params are hidden as we don't want users to try and create instances of this...

		 @param {XMLHttpRequest} nativeResponse
		 @param {Boolean} [timedOut=false] Set to true if the response timed out
		 @param {glow.net.Request} [request] Original request object
		*/
		function Response(nativeResponse, timedOut, request) {
			//run Event constructor
			events.Event.call(this);
			
			/**
			@name glow.net.Response#_request
			@private
			@description Original request object
			@type glow.net.Request
			*/
			this._request = request;
			
			/**
			@name glow.net.Response#nativeResponse
			@description The response object from the browser.
				This may not have the same properties and methods across user agents.
			@type Object
			*/
			this.nativeResponse = nativeResponse;
			/**
			@name glow.net.Response#status
			@description HTTP status code of the response
			@type Number
			*/
			//IE reports status as 1223 rather than 204, for laffs
			this.status = timedOut ? 408 :
				nativeResponse.status == 1223 ? 204 : nativeResponse.status;

			/**
			 * @name glow.net.Response#timedOut
			 * @description Boolean indicating if the requests time out was reached.
			 * @type Boolean
			 */
			this.timedOut = !!timedOut;

			/**
			 * @name glow.net.Response#wasSuccessful
			 * @description  Boolean indicating if the request returned successfully.
			 * @type Boolean
			 */
			this.wasSuccessful = (this.status >= 200 && this.status < 300) ||
				//from cache
				this.status == 304 ||
				//watch our for requests from file://
				(this.status == 0 && nativeResponse.responseText);

		}
		
		/**
		@name glow.net-shouldParseAsXml
		@function
		@description Should the response be treated as xml? This function is used by IE only
			'this' is the response object
		@returns {Boolean}
		*/
		function shouldParseAsXml() {
			var contentType = this.header("Content-Type");
			// IE 6 & 7 fail to recognise Content-Types ending +xml (eg application/rss+xml)
			// Files from the filesystem don't have a content type, but could be xml files, parse them to be safe
			return endsPlusXml.test(contentType) || contentType === '';
		}
		
		//don't want to document this inheritance, it'll just confuse the user
		glow.lang.extend(Response, events.Event, {
			/**
			@name glow.net.Response#text
			@function
			@description Gets the body of the response as plain text
			@returns {String}
				Response as text
			*/
			text: function() {
				return this.nativeResponse.responseText;
			},
			/**
			@name glow.net.Response#xml
			@function
			@description Gets the body of the response as xml
			@returns {xml}
				Response as XML
			*/
			xml: function() {
				var nativeResponse = this.nativeResponse;
				
				if (
					// IE fails to recognise the doc as XML in some cases
					( glow.env.ie && shouldParseAsXml.call(this) )
					// If the _forceXml option is set, we need to turn the response text into xml
					|| ( this._request._forceXml && !this._request.nativeRequest.overrideMimeType && window.ActiveXObject )
				) {
					var doc = new ActiveXObject("Microsoft.XMLDOM");
                    doc.loadXML( nativeResponse.responseText );
					return doc;
				}
				else {
					// check property exists
					if (!nativeResponse.responseXML) {
						throw new Error(STR.XML_ERR);
					}
					return nativeResponse.responseXML;
				}				
			},

			/**
			@name glow.net.Response#json
			@function
			@description Gets the body of the response as a json object

			@param {Boolean} [safeMode=false]
				If true, the response will be parsed using a string parser which
				will filter out non-JSON javascript, this will be slower but
				recommended if you do not trust the data source.

			@returns {Object}
			*/
			json: function(safe) {
				return glow.data.decodeJson(this.text(), {safeMode:safe});
			},

			/**
			@name glow.net.Response#header
			@function
			@description Gets a header from the response

			@param {String} name
				Header name

			@returns {String}
				Header value

			@example var contentType = myResponse.header("Content-Type");
			*/
			header: function(name) {
				return this.nativeResponse.getResponseHeader(name);
			},

			/**
			@name glow.net.Response#statusText
			@function
			@description Gets the meaning of {@link glow.net.Response#status myResponse.status}

			@returns {String}
			*/
			statusText: function() {
				return this.timedOut ? "Request Timeout" : this.nativeResponse.statusText;
			}
		})

		glow.net = r;
	}
});

/**
@name glow.tweens
@namespace
@description Functions for modifying animations
@see <a href="../furtherinfo/tweens">What are tweens?</a>

*/
(window.gloader || glow).module({
	name: "glow.tweens",
	library: ["glow", "1.7.0"],
	depends: [],
	builder: function(glow) {

		/*
		PrivateMethod: _reverse
			Takes a tween function and returns a function which does the reverse
		*/
		function _reverse(tween) {
			return function(t) {
				return 1 - tween(1 - t);
			}
		}

		glow.tweens = {
			/**
			@name glow.tweens.linear
			@function
			@description Returns linear tween.

				Will transition values from start to finish with no
				acceleration or deceleration.

			@returns {Function}
			*/
			linear: function() {
				return function(t) { return t; };
			},
			/**
			@name glow.tweens.easeIn
			@function
			@description Creates a tween which starts off slowly and accelerates.

			@param {Number} [strength=2] How strong the easing is.

				A higher number means the animation starts off slower and
				ends quicker.

			@returns {Function}
			*/
			easeIn: function(strength) {
				strength = strength || 2;
				return function(t) {
					return Math.pow(1, strength - 1) * Math.pow(t, strength);
				}
			},
			/**
			@name glow.tweens.easeOut
			@function
			@description Creates a tween which starts off fast and decelerates.

			@param {Number} [strength=2] How strong the easing is.

				A higher number means the animation starts off faster and
				ends slower

			@returns {Function}
			 */
			easeOut: function(strength) {
				return _reverse(this.easeIn(strength));
			},
			/**
			@name glow.tweens.easeBoth
			@function
			@description Creates a tween which starts off slowly, accelerates then decelerates after the half way point.

				This produces a smooth and natural looking transition.

			@param {Number} [strength=2] How strong the easing is.

				A higher number produces a greater difference between
				start / end speed and the mid speed.

			@returns {Function}
			*/
			easeBoth: function(strength) {
				return this.combine(this.easeIn(strength), this.easeOut(strength));
			},
			/**
			@name glow.tweens.overshootIn
			@function
			@description Returns the reverse of {@link glow.tweens.overshootOut overshootOut}

			@param {Number} [amount=1.70158] How much to overshoot.

				The default is 1.70158 which results in a 10% overshoot.

			@returns {Function}
			*/
			overshootIn: function(amount) {
				return _reverse(this.overshootOut(amount));
			},
			/**
			@name glow.tweens.overshootOut
			@function
			@description Creates a tween which overshoots its end point then returns to its end point.

			@param {Number} [amount=1.70158] How much to overshoot.

				The default is 1.70158 which results in a 10% overshoot.

			@returns {Function}
			*/
			overshootOut: function(amount) {
				amount = amount || 1.70158;
				return function(t) {
					if (t == 0 || t == 1) { return t; }
					return ((t -= 1)* t * ((amount + 1) * t + amount) + 1);
				}
			},
			/**
			@name glow.tweens.overshootBoth
			@function
			@description Returns a combination of {@link glow.tweens.overshootIn overshootIn} and {@link glow.tweens.overshootOut overshootOut}

			@param {Number} [amount=1.70158] How much to overshoot.

				The default is 1.70158 which results in a 10% overshoot.

			@returns {Function}
			*/
			overshootBoth: function(amount) {
				return this.combine(this.overshootIn(amount), this.overshootOut(amount));
			},
			/**
			@name glow.tweens.bounceIn
			@function
			@description Returns the reverse of {@link glow.tweens.bounceOut bounceOut}

			@returns {Function}
			*/
			bounceIn: function() {
				return _reverse(this.bounceOut());
			},
			/**
			@name glow.tweens.bounceOut
			@function
			@description Returns a tween which bounces against the final value 3 times before stopping

			@returns {Function}
			*/
			bounceOut: function() {
				return function(t) {
					if (t < (1 / 2.75)) {
						return 7.5625 * t * t;
					} else if (t < (2 / 2.75)) {
						return (7.5625 * (t -= (1.5 / 2.75)) * t + .75);
					} else if (t < (2.5 / 2.75)) {
						return (7.5625 * (t -= (2.25 / 2.75)) * t + .9375);
					} else {
						return (7.5625 * (t -= (2.625 / 2.75)) * t + .984375);
					}
				};
			},
			/**
			@name glow.tweens.bounceBoth
			@function
			@description Returns a combination of {@link glow.tweens.bounceIn bounceIn} and {@link glow.tweens.bounceOut bounceOut}

			@returns {Function}
			*/
			bounceBoth: function() {
				return this.combine(this.bounceIn(), this.bounceOut());
			},
			/**
			@name glow.tweens.elasticIn
			@function
			@description Returns the reverse of {@link glow.tweens.elasticOut elasticOut}

			@param {Number} [amplitude=1] How strong the elasticity is.

			@param {Number} [period=0.3] The frequency period.

			@returns {Function}
			*/
			elasticIn: function(a, p) {
				return _reverse(this.elasticOut(a, p));
			},
			/**
			@name glow.tweens.elasticOut
			@function
			@description Creates a tween which has an elastic movement.

				You can tweak the tween using the parameters but you'll
				probably find the defaults sufficient.

			@param {Number} [amplitude=1] How strong the elasticity is.

			@param {Number} [period=0.3] The frequency period.

			@returns {Function}
			*/
			elasticOut: function(a, p) {
				return function (t) {
					if (t == 0 || t == 1) {
						return t;
					}
					if (!p) {
						p = 0.3;
					}
					if (!a || a < 1) {
						a = 1;
						var s = p / 4;
					} else {
						var s = p / (2 * Math.PI) * Math.asin(1 / a);
					}
					return a * Math.pow(2, -10 * t) * Math.sin( (t-s) * (2 * Math.PI) / p) + 1;
				}
			},
			/**
			@name glow.tweens.elasticBoth
			@function
			@description Returns a combination of {@link glow.tweens.elasticIn elasticIn} and {@link glow.tweens.elasticOut elasticOut}

			@param {Number} [amplitude=1] How strong the elasticity is.

			@param {Number} [period=0.3] The frequency period.

			@returns {Function}
			*/
			elasticBoth: function(a, p) {
				p = p || 0.45;
				return this.combine(this.elasticIn(a, p), this.elasticOut(a, p));
			},
			/**
			@name glow.tweens.combine
			@function
			@description Create a tween from two tweens.

				This can be useful to make custom tweens which, for example,
				start with an easeIn and end with an overshootOut. To keep
				the motion natural, you should configure your tweens so the
				first ends and the same velocity that the second starts.

			@param {Function} tweenIn Tween to use for the first half

			@param {Function} tweenOut Tween to use for the second half

			@example
				// 4.5 has been chosen for the easeIn strength so it
				// ends at the same velocity as overshootOut starts.
				var myTween = glow.tweens.combine(
					glow.tweens.easeIn(4.5),
					glow.tweens.overshootOut()
				);

			@returns {Function}
			*/
			combine: function(tweenIn, tweenOut) {
				return function (t) {
					if (t < 0.5) {
						return tweenIn(t * 2) / 2;
					} else {
						return tweenOut((t - 0.5) * 2) / 2 + 0.5;
					}
				}
			}
		};
	}
});
/**
@name glow.anim
@namespace
@description Simple and powerful animations.
@requires glow, glow.tweens, glow.events, glow.dom
@see <a href="../furtherinfo/tweens/">What are tweens?</a>
@see <a href="../furtherinfo/anim/">Guide to creating animations, with interactive examples</a>
*/
(window.gloader || glow).module({
	name: "glow.anim",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", "glow.tweens", "glow.events", "glow.dom"]],
	builder: function(glow) {
		//private
		var $ = glow.dom.get,
			manager,
			events = glow.events,
			dom = glow.dom,
			get = dom.get,
			hasUnits = /width|height|top$|bottom$|left$|right$|spacing$|indent$|font-size/,
			noNegatives = /width|height|padding|opacity/,
			usesYAxis = /height|top/,
			getUnit = /(\D+)$/,
			testElement = dom.create('<div style="position:absolute;visibility:hidden"></div>');
		
		/*
		  Converts event shortcuts in an options object to real events
		  instance - the object to add events to
		  opts - the options object containing the listener functions
		  eventProps - an array of property names of potential listeners, eg ['onFrame', 'onComplete']
		*/
		function addEventsFromOpts(instance, opts, eventProps) {
			for (var i = 0, len = eventProps.length; i < len; i++) {
				// does opts.onWhatever exist?
				if (opts[ eventProps[i] ]) {
					events.addListener(
						instance,
						// convert "onWhatever" to "whatever"
						eventProps[i].slice(2).toLowerCase(),
						opts[ eventProps[i] ]
					);
				}
			}
		}
		
		(function() {
			var queue = [], //running animations
				queueLen = 0,
				intervalTime = 1, //ms between intervals
				interval; //holds the number for the interval
			manager = {
				/**
				@name glow.anim-manager.addToQueue
				@private
				@function
				@description Adds an animation to the queue.
				*/
				addToQueue: function(anim) {
					//add the item to the queue
					queue[queueLen++] = anim;
					anim._playing = true;
					anim._timeAnchor = anim._timeAnchor || new Date().valueOf();
					if (!interval) {
						this.startInterval();
					}
				},
				/**
				@name glow.anim-manager.removeFromQueue
				@private
				@function
				@description Removes an animation from the queue.
				*/
				removeFromQueue: function(anim) {
					for (var i = 0; i < queueLen; i++) {
						if (queue[i] == anim) {
							queue.splice(i, 1);
							anim._timeAnchor = null;
							anim._playing = false;
							//stop the queue if there's nothing in it anymore
							if (--queueLen == 0) {
								this.stopInterval();
							}
							return;
						}
					}
				},
				/**
				@name glow.anim-manager.startInterval
				@private
				@function
				@description Start processing the queue every interval.
				*/
				startInterval: function() {
					interval = window.setInterval(this.processQueue, intervalTime);
				},
				/**
				@name glow.anim-manager.stopInterval
				@private
				@function
				@description Stop processing the queue.
				*/
				stopInterval: function() {
					window.clearInterval(interval);
					interval = null;
				},
				/**
				@name glow.anim-manager.processQueue
				@private
				@function
				@description Animate each animation in the queue.
				*/
				processQueue: function() {
					var anim, i, now = new Date().valueOf();
					for (i = 0; i < queueLen; i++) {
						anim = queue[i];
						if (anim.position == anim.duration) {
							manager.removeFromQueue(anim);
							//need to decrement the index because we've just removed an item from the queue
							i--;
							events.fire(anim, "complete");
							if (anim._opts.destroyOnComplete) {
								anim.destroy();
							}
							continue;
						}
						if (anim.useSeconds) {
							anim.position = (now - anim._timeAnchor) / 1000;
							if (anim.position > anim.duration) {
								anim.position = anim.duration;
							}
						} else {
							anim.position++;
						}
						anim.value = anim.tween(anim.position / anim.duration);
						events.fire(anim, "frame");
					}
				}
			};
		})();

		/**
		@name glow.anim.convertCssUnit
		@private
		@function
		@param {nodelist} element
		@param {string|number} fromValue Assumed pixels.
		@param {string} toUnit (em|%|pt...)
		@param {string} axis (x|y)
		@description Converts a css unit.

		We need to know the axis for calculating relative values, since they're
		relative to the width / height of the parent element depending
		on the situation.

		*/
		function convertCssUnit(element, fromValue, toUnit, axis) {
			var elmStyle = testElement[0].style,
				axisProp = (axis == "x") ? "width" : "height",
				startPixelValue,
				toUnitPixelValue;
			//reset stuff that may affect the width / height
			elmStyle.margin = elmStyle.padding = elmStyle.border = "0";
			startPixelValue = testElement.css(axisProp, fromValue).insertAfter(element)[axisProp]();
			//using 10 of the unit then dividing by 10 to increase accuracy
			toUnitPixelValue = testElement.css(axisProp, 10 + toUnit)[axisProp]() / 10;
			testElement.remove();
			return startPixelValue / toUnitPixelValue;
		}

		/**
		@name glow.anim.keepWithinRange
		@private
		@function
		@param num
		@param [start]
		@param [end]
		@description
		Takes a number then an (optional) lower range and an (optional) upper range. If the number
		is outside the range the nearest range boundary is returned, else the number is returned.
		*/
		function keepWithinRange(num, start, end) {
			if (start !== undefined && num < start) {
				return start;
			}
			if (end !== undefined && num > end) {
				return end;
			}
			return num;
		}

		/**
		@name glow.anim.buildAnimFunction
		@private
		@function
		@param element
		@param spec
		@description Builds a function for an animation.
		*/
		function buildAnimFunction(element, spec) {
			var cssProp,
				r = ["a=(function(){"],
				rLen = 1,
				fromUnit,
				unitDefault = [0,"px"],
				to,
				from,
				unit,
				a;

			for (cssProp in spec) {
				r[rLen++] = 'element.css("' + cssProp + '", ';
				//fill in the blanks
				if (typeof spec[cssProp] != "object") {
					to = spec[cssProp];
				} else {
					to = spec[cssProp].to;
				}
				if ((from = spec[cssProp].from) === undefined) {
					if (cssProp == "font-size" || cssProp == "background-position") {
						throw new Error("From value must be set for " + cssProp);
					}
					from = element.css(cssProp);
				}
				//TODO help some multi value things?
				if (hasUnits.test(cssProp)) {
					//normalise the units for unit-ed values
					unit = (getUnit.exec(to) || unitDefault)[1];
					fromUnit = (getUnit.exec(from) || unitDefault)[1];
					//make them numbers, we have the units seperate
					from = parseFloat(from) || 0;
					to = parseFloat(to) || 0;
					//if the units don't match, we need to have a play
					if (from && unit != fromUnit) {
						if (cssProp == "font-size") {
							throw new Error("Units must be the same for font-size");
						}
						from = convertCssUnit(element, from + fromUnit, unit, usesYAxis.test(cssProp) ? "y" : "x");
					}
					if (noNegatives.test(cssProp)) {
						r[rLen++] = 'keepWithinRange((' + (to - from) + ' * this.value) + ' + from + ', 0) + "' + unit + '"';
					} else {
						r[rLen++] = '(' + (to - from) + ' * this.value) + ' + from + ' + "' + unit + '"';
					}
				} else if (! (isNaN(from) || isNaN(to))) { //both pure numbers
					from = Number(from);
					to = Number(to);
					r[rLen++] = '(' + (to - from) + ' * this.value) + ' + from;
				} else if (cssProp.indexOf("color") != -1) {
					to = dom.parseCssColor(to);
					if (! glow.lang.hasOwnProperty(from, "r")) {
						from = dom.parseCssColor(from);
					}
					r[rLen++] = '"rgb(" + keepWithinRange(Math.round(' + (to.r - from.r) + ' * this.value + ' + from.r +
						'), 0, 255) + "," + keepWithinRange(Math.round(' + (to.g - from.g) + ' * this.value + ' + from.g +
						'), 0, 255) + "," + keepWithinRange(Math.round(' + (to.b - from.b) + ' * this.value + ' + from.b +
						'), 0, 255) + ")"';
				} else if (cssProp == "background-position") {
					var vals = {},
						fromTo = ["from", "to"],
						unit = (getUnit.exec(from) || unitDefault)[1];
					vals.fromOrig = from.toString().split(/\s/);
					vals.toOrig = to.toString().split(/\s/);

					if (vals.fromOrig[1] === undefined) {
						vals.fromOrig[1] = "50%";
					}
					if (vals.toOrig[1] === undefined) {
						vals.toOrig[1] = "50%";
					}

					for (var i = 0; i < 2; i++) {
						vals[fromTo[i] + "X"] = parseFloat(vals[fromTo[i] + "Orig"][0]);
						vals[fromTo[i] + "Y"] = parseFloat(vals[fromTo[i] + "Orig"][1]);
						vals[fromTo[i] + "XUnit"] = (getUnit.exec(vals[fromTo[i] + "Orig"][0]) || unitDefault)[1];
						vals[fromTo[i] + "YUnit"] = (getUnit.exec(vals[fromTo[i] + "Orig"][1]) || unitDefault)[1];
					}

					if ((vals.fromXUnit !== vals.toXUnit) || (vals.fromYUnit !== vals.toYUnit)) {
						throw new Error("Mismatched axis units cannot be used for " + cssProp);
					}

					r[rLen++] = '(' + (vals.toX - vals.fromX) + ' * this.value + ' + vals.fromX + ') + "' + vals.fromXUnit + ' " + (' +
								(vals.toY - vals.fromY) + ' * this.value + ' + vals.fromY + ') + "' + vals.fromYUnit + '"';
				}
				r[rLen++] = ');';
			}
			r[rLen++] = "})";
			return eval(r.join(""));
		}

		//public
		var r = {}; //return object

		/**
		@name glow.anim.css
		@function
		@description Animates CSS properties of an element.
		@param {String | glow.dom.NodeList | Element} element Element to animate.

			This can be a CSS selector (first match will be used),
			{@link glow.dom.NodeList} (first node will be used), or a DOM element.

		@param {Number} duration Animation duration, in seconds by default.

		@param {Object} spec An object describing the properties to animate.

			This object should consist of property names corresponding to the
			CSS properties you wish to animate, and values which are objects
			with 'from' and 'to' properties with the values to animate between
			or a number/string representing the value to animate to.

			If the 'from' property is absent, the elements current CSS value
			will be used instead.

			See the spec example below for more information.

		@param {Object} opts Optional options object.

		@param {Boolean} [opts.useSeconds=true] Specifies whether duration should be in seconds rather than frames.

		@param {Function} [opts.tween=linear tween] The way the value moves through time. See {@link glow.tweens}.
		
		@param {Boolean} [opts.destroyOnComplete=false] Destroy the animation once it completes?
			This will free any DOM references the animation may have created. Once
			the animation completes, you won't be able to start it again.
			
		@param {Function} [opts.onStart] Shortcut for adding a "start" event listener
		@param {Function} [opts.onFrame] Shortcut for adding a "frame" event listener
		@param {Function} [opts.onStop] Shortcut for adding a "stop" event listener
		@param {Function} [opts.onComplete] Shortcut for adding a "complete" event listener
		@param {Function} [opts.onResume] Shortcut for adding a "resume" event listener
		
		@example
		// an example of an spec object
		{
			"height": {from: "10px", to: "100px"},
			"width": "100px",
			"font-size": {from: "0.5em", to: "1.3em"}
		}

		@example
		// animate an elements height and opacity to 0 from current values over 1 second
		glow.anim.css("#myElement", 1, {
			"height" : 0,
			"opacity" : 0
		}).start();

		@returns {glow.anim.Animation}
		*/
		r.css = function(element, duration, spec, opts) {

			element = get(element);

			var anim = new r.Animation(duration, opts);

			// Fix for trac 156 - glow.anim.css should fail better if the element doesn't exist
			if (element[0]) {
				events.addListener(anim, "frame", buildAnimFunction(element, spec));
			}
			return anim;
		};
		
		/**
		@name glow.anim-slideElement
		@private
		@function
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		@param {Number} duration Animation duration in seconds.
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		@description Builds a function for an animation.
		*/
		slideElement = function slideElement(element, duration, action, opts) {
			duration = duration || 0.5;
			// normalise 'element' to NodeList
			element = $(element);
			
			opts = glow.lang.apply({
				tween: glow.tweens.easeBoth(),
				onStart: function(){},
				onComplete: function(){}
			}, opts);
			
			var i = 0,
				thatlength = element.length,
				completeHeight,
				fromHeight,
				channels = [],
				timeline;
			
			for(; i < thatlength; i++) {
				if (action == "up" || (action == "toggle" && element.slice(i, i+1).height() > 0)) {
					element[i].style.overflow = 'hidden';
					// give the element layout in IE
					if (glow.env.ie < 8) {
						element[i].style.zoom = 1;
					}
					completeHeight = 0;
					fromHeight = element.slice(i, i+1).height();
				} else if (action == "down" || (action == "toggle" && element.slice(i, i+1).height() == 0)) {
					fromHeight = element.slice(i, i+1).height();
					element[i].style.height = "auto";
					completeHeight = element.slice(i, i+1).height();
					element[i].style.height = fromHeight + "px";
				}

				channels[i] = [
					glow.anim.css(element[i], duration, {
						'height': {from: fromHeight, to: completeHeight}
					}, { tween: opts.tween })
				];

			}
			
			timeline = new glow.anim.Timeline(channels, {
				destroyOnComplete: true
			});
			
			events.addListener(timeline, "complete", function() {
				// return heights to "auto" for slide down
				element.each(function() {
					if (this.style.height != "0px") {
						this.style.height = "auto";
					}
				})
			});
			
			events.addListener(timeline, "start", opts.onStart);
			events.addListener(timeline, "complete", opts.onComplete);
			
			// return & start our new timeline
			return timeline.start();
		};

		/**
		@name glow.anim.slideDown
		@function
		@description Slide a NodeList down from a height of 0 
		
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {Number} duration Animation duration in seconds.
		
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		
			glow.anim.slideDown("#menu", 1);
		 		 
		**/	
		r.slideDown = function(element, duration, opts) {
			return slideElement(element, duration, 'down', opts);
		};

		/**
		@name glow.anim.slideUp
		@function
		@description Slide a NodeList up to a height of 0 
		
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {Number} duration Animation duration in seconds.
		
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.slideUp("#menu", 1);
		 		 
		**/		
		r.slideUp = function(element, duration, opts) {
			return slideElement(element, duration, 'up', opts);
		};
		
		/**
		@name glow.anim.slideToggle
		@function
		@description Toggle a NodeList Up or Down depending on it's present state. 
		
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {Number} duration Animation duration in seconds.
		
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.slideToggle("#menu", 1);
		 		 
		**/			
		r.slideToggle = function(element, duration, opts) {
			return slideElement(element, duration, 'toggle', opts);
		};


		/**
		@name glow.anim.fadeOut
		@function
		@description Fade out a set of elements 
		
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {Number} duration Animation duration in seconds.
		
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.fadeOut("#menu", 1);
		 		 
		**/
		r.fadeOut = function(element, duration, opts) {
			return r.fadeTo(element, 0, duration, opts)
        };
		
		/**
		@name glow.anim.fadeIn
		@function
		@description Fade in a set of elements 
		 
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {Number} duration Animation duration in seconds.
		  
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.fadeIn("#menu", 1);
		 		 
		**/
		r.fadeIn = function(element, duration, opts){
			r.fadeTo(element, 1, duration, opts);
        };
		
		/**
		@name glow.anim.fadeTo
		@function
		@description Fade a set of elements to a given opacity
		 
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		 
		@param {Number} opacity fade to opacity level between 0 & 1. 
		 
		@param {Number} duration Animation duration in seconds.
		  
		@param {Function} opts Object
		 
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.fadeTo("#menu", 0.5, 1);
		 		 
		**/
		r.fadeTo = function(element, opacity, duration, opts){
			duration = duration || 0.5;
			// normalise 'element' to NodeList
			element = $(element);
			
			opts = glow.lang.apply({
				tween: glow.tweens.easeBoth(),
				onStart: function(){},
				onComplete: function(){}
			}, opts);
			
			var i = 0,
				thatlength = element.length,
				channels = [],
				timeline;
			
			for(; i < thatlength; i++) {
				channels[i] = [
					glow.anim.css(element[i], duration, {
						'opacity': opacity
					}, { tween: opts.tween })
				];
			}
			
			timeline = new glow.anim.Timeline(channels, {
				destroyOnComplete: true
			});
			
			events.addListener(timeline, "start", opts.onStart);
			events.addListener(timeline, "complete", opts.onComplete);
			
			// return & start our new timeline
			return timeline.start();
        };
        

		/**
		@name glow.anim.highlight
		@function
		@description	Highlight an element by fading the background colour
		 
		@param {String | glow.dom.NodeList} element Element to animate. CSS Selector can be used.
		
		@param {String} highlightColour highlight colour in hex, "rgb(r, g, b)" or css colour name. 
		 
		@param {Number} duration Animation duration in seconds.
		  
		@param {Function} opts Object
		 
		@param {Function} [opts.completeColour] The background colour of the element once the highlight is complete.
		
		 				  If none supplied Glow assumes the element's existing background color (e.g. #336699),
		 				  if the element has no background color specified (e.g. Transparent)
		 				  the highlight will transition to white.
		
		@param {Function} [opts.tween=easeBoth tween] The way the value moves through time. See {@link glow.tweens}.
		  
		@param {Function} [opts.onStart] The function to be called when the first element in the NodeList starts the animation.  
		 
		@param {Function} [opts.onComplete] The function to be called when the first element in the NodeList completes the animation.
		
		@returns {glow.anim.Timeline}
		
			A started timeline
		
		@example
		  		
			glow.anim.highlight("#textInput", "#ff0", 1);
		**/
		r.highlight = function(element, highlightColour, duration, opts){
			// normalise element
			element = $(element);
			
			duration = duration || 1;
			highlightColour = highlightColour || '#ffff99';
			
			opts = glow.lang.apply({
				tween: glow.tweens.easeBoth(),
				onStart: function(){},
				onComplete: function(){}
			}, opts);
			
			var i = 0, 
				transArray = [],
				elmsLength = element.length,
				completeColour,
				channels = [],
				timeline;
			
			for(; i < elmsLength; i++) {
				
				completeColour = opts.completeColour || element.slice(i, i+1).css("background-color");

				if (completeColour == "transparent" || completeColour == "") { 
					completeColour = "#fff";
				}
				channels[i] = [
					r.css(element[i], duration, {
						"background-color" : {from:highlightColour, to:completeColour}
					}, {tween: opts.tween})
				];
			}
			
			timeline = new glow.anim.Timeline(channels, {
				destroyOnComplete: true
			});
			
			events.addListener(timeline, "start", opts.onStart);
			events.addListener(timeline, "complete", opts.onComplete);
			return timeline.start();
        };

		/**
		@name glow.anim.Animation
		@class
		@description Controls modifying values over time.

			You can create an animtion instance using the constructor, or use
			one of the helper methods in {@link glow.anim}.

			Once you have created your animation instance, you can use
			events such as "frame" to change values over time.

		@param {Number} duration Length of the animation in seconds / frames.

			Animations which are given a duration in seconds may drop frames to
			finish in the given time.

		@param {Object} opts Object of options.

		@param {Boolean} [opts.useSeconds=true] Specifies whether duration should be in seconds rather than frames.

		@param {Function} [opts.tween=linear tween] The way the value moves through time.

			See {@link glow.tweens}.
			
		@param {Boolean} [opts.destroyOnComplete=false] Destroy the animation once it completes?
			This will free any DOM references the animation may have created. Once
			the animation completes, you won't be able to start it again.
			
		@param {Function} [opts.onStart] Shortcut for adding a "start" event listener
		@param {Function} [opts.onFrame] Shortcut for adding a "frame" event listener
		@param {Function} [opts.onStop] Shortcut for adding a "stop" event listener
		@param {Function} [opts.onComplete] Shortcut for adding a "complete" event listener
		@param {Function} [opts.onResume] Shortcut for adding a "resume" event listener

		@example
			var myAnim = new glow.anim.Animation(5, {
				tween:glow.tweens.easeBoth()
			});

		*/

		/**
		@name glow.anim.Animation#event:start
		@event
		@description Fired when the animation is started from the beginning.
		@param {glow.events.Event} event Event Object
		@example
			var myAnim = new glow.anim.Animation(5, {
				tween:glow.tweens.easeBoth()
			});
			glow.events.addListener(myAnim, "start", function() {
				alert("Started animation which lasts " + this.duration + " seconds");
			});
			myAnim.start();
		*/

		/**
		@name glow.anim.Animation#event:frame
		@event
		@description Fired in each frame of the animation.

			This is where you'll specify what your animation does.
		
		@param {glow.events.Event} event Event Object
		@example
			var myAnim = new glow.anim.Animation(5, {
				tween:glow.tweens.easeBoth()
			});
			
			var myDiv = glow.dom.get("#myDiv"),
			    divStartHeight = myDiv.height(),
			    divEndHeight = 500,
			    divHeightChange = divEndHeight - divStartHeight;

			glow.events.addListener(myAnim, "frame", function() {
				myDiv.height(divStartHeight + (divHeightChange * this.value));
			});
			myAnim.start();
		*/

		/**
		@name glow.anim.Animation#event:stop
		@event
		@description Fired when the animation is stopped before its end.

			If your listener prevents the default action (for instance,
			by returning false) the animtion will not be stopped.
		
		@param {glow.events.Event} event Event Object
		*/

		/**
		@name glow.anim.Animation#event:complete
		@event
		@description Fired when the animation ends.
		@param {glow.events.Event} event Event Object
		*/

		/**
		@name glow.anim.Animation#event:resume
		@event
		@description Fired when the animation resumes after being stopped.

			If your listener prevents the default action (for instance, by
			returning false) the animation will not be resumed.

		@param {glow.events.Event} event Event Object
		*/
		// constructor items that relate to events
		var animationEventConstructorNames = ["onStart", "onStop", "onComplete", "onResume", "onFrame"];
		
		r.Animation = function(duration, opts) {
			this._opts = opts = glow.lang.apply({
				useSeconds: true,
				tween: glow.tweens.linear(),
				destroyOnComplete: false,
				onStart: null,
				onStop: null,
				onComplete: null,
				onResume: null,
				onFrame: null
			}, opts);

			/**
			@name glow.anim.Animation#_playing
			@type Boolean
			@private
			@default false
			@description Indicates whether the animation is playing.
			*/
			this._playing = false;

			/**
			@name glow.anim.Animation#_timeAnchor
			@type Number
			@private
			@default null
			@description A timestamp used to keep the animation in the right position.
			*/
			this._timeAnchor = null;

			/**
			@name glow.anim.Animation#duration
			@type Number
			@description Length of the animation in seconds / frames.
			*/
			this.duration = duration;

			/**
			@name glow.anim.Animation#useSeconds
			@type Boolean
			@description Indicates whether duration is in seconds rather than frames.
			*/
			this.useSeconds = opts.useSeconds;

			/**
			@name glow.anim.Animation#tween
			@type Function
			@description The tween used by the animation.
			*/
			this.tween = opts.tween;

			/**
			@name glow.anim.Animation#position
			@type Number
			@default 0
			@description Seconds since starting, or current frame.
			*/
			this.position = 0;

			/**
			@name glow.anim.Animation#value
			@type Number
			@default 0
			@description Current tweened value of the animtion, usually between 0 & 1.
				The value may become greater than 1 or less than 0 depending
				on the tween used.
				
				{@link glow.tweens.elasticOut} for instance will result
				in values higher than 1, but will still end at 1.
			*/
			this.value = 0;
			
			// add events from constructor opts
			addEventsFromOpts(this, opts, animationEventConstructorNames);
		};
		r.Animation.prototype = {

			/**
			@name glow.anim.Animation#start
			@function
			@description Starts playing the animation from the beginning.
			@example
				var myAnim = new glow.anim.Animation(5, {
					tween:glow.tweens.easeBoth()
				});
				//attach events here
				myAnim.start();
			@returns {glow.anim.Animation}
			*/
			start: function() {
				if (this._playing) {
					this.stop();
				}
				var e = events.fire(this, "start");
				if (e.defaultPrevented()) { return this; }
				this._timeAnchor = null;
				this.position = 0;
				manager.addToQueue(this);

				return this;
			},

			/**
			@name glow.anim.Animation#stop
			@function
			@description Stops the animation playing.
			@returns {glow.anim.Animation}
			*/
			stop: function() {
				if (this._playing) {
					var e = events.fire(this, "stop");
					if (e.defaultPrevented()) { return this; }
					manager.removeFromQueue(this);
				}
				return this;
			},
			
			/**
			@name glow.anim.Animation#destroy
			@function
			@description Destroys the animation & detatches references to DOM nodes
				Call this on animations you no longer need to free memory.
			@returns {glow.anim.Animation}
			*/
			destroy: function() {
				// stop the animation in case it's still playing
				this.stop();
				events.removeAllListeners(this);
				return this;
			},

			/**
			@name glow.anim.Animation#resume
			@function
			@description Resumes the animation from where it was stopped.
			@returns {glow.anim.Animation}
			*/
			resume: function() {
				if (! this._playing) {
					var e = events.fire(this, "resume");
					if (e.defaultPrevented()) { return this; }
					//set the start time to cater for the pause
					this._timeAnchor = new Date().valueOf() - (this.position * 1000);
					manager.addToQueue(this);
				}
				return this;
			},

			/**
			@name glow.anim.Animation#isPlaying
			@function
			@description Returns true if the animation is playing.
			@returns {Boolean}
			*/
			isPlaying: function() {
				return this._playing;
			},
			/**
			@name glow.anim.Animation#goTo
			@function
			@description Goes to a specific point in the animation.
			@param {Number} pos Position in the animation to go to.

				This should be in the same units as the duration of your
				animation (seconds or frames).

			@example
				var myAnim = new glow.anim.Animation(5, {
					tween:glow.tweens.easeBoth()
				});
				//attach events here
				//start the animation from half way through
				myAnim.goTo(2.5).resume();
			@returns this
			*/
			goTo: function(pos) {
				this._timeAnchor = new Date().valueOf() - ((this.position = pos) * 1000);
				this.value = this.tween(this.duration && this.position / this.duration);
				events.fire(this, "frame");
				return this;
			}
		};

		/**
		@name glow.anim.Timeline
		@class
		@description Synchronises and chains animations.
		@param {Array | Array[]} channels An array of channels or a single channel.

			A channel is defined as an array containing numbers, animations and
			functions.

			Numbers indicate a number of seconds to wait before proceeding to
			the next item. Animations will be played, when the animation is
			complete the next item is processed. Functions will be called, then
			the next item is processed.

		@param {Object} opts An object of options.
		@param {Boolean} [opts.loop=false] Specifies whether the timeline loops.

			The "complete" event does not fire for looping animations.
			
		@param {Boolean} [opts.destroyOnComplete=false] Destroy the animation once it completes?
			This will free any DOM references the animation may have created. Once
			the animation completes, you won't be able to start it again.
			
		@param {Function} [opts.onStart] Shortcut for adding a "start" event listener
		@param {Function} [opts.onStop] Shortcut for adding a "stop" event listener
		@param {Function} [opts.onComplete] Shortcut for adding a "complete" event listener
		@param {Function} [opts.onResume] Shortcut for adding a "resume" event listener

		@example
			// in the simplest form, a timeline can be used to
			// string multiple animations together:
			

			// make our animations
			var moveUp = glow.anim.css(myDiv, 2, {
				"top": {to:"0"}
			});
			var moveDown = glow.anim.css(myDiv, 1, {
				"top": {to:"100px"}
			});
			// string them together
			new glow.anim.Timeline([moveUp, moveDown]).start();

		@example
			// if you wanted a one second gap between the animations, the last line would be:
			new glow.anim.Timeline([moveUp, 1, moveDown]).start();

		@example
			// you can run animations simutainiously with multiple channels.
			new glow.anim.Timeline([
				[moveDivUp, 1, moveDivDown],
				[moveListDown, 1, moveListUp]
			]).start();
		@see <a href="../furtherinfo/animtimeline/">Creating a mexican wave with an animation timeline</a>
		*/
		/**
		@name glow.anim.Timeline#event:start
		@event
		@description Fired when the timeline is started from the beginning.

			This event will also trigger during each loop of a looping animation.
			If your listener prevents the default action (for instance, by
			returning false) the timeline will not start.
		
		@param {glow.events.Event} event Event Object
		@example
			var myTimeline = new glow.anim.Timeline([anim1, anim2]);
			glow.events.addListener(myTimeline, "start", function() {
				alert("Started timeline");
			});
			myTimeline.start();
		*/
		/**
		@name glow.anim.Timeline#event:stop
		@event
		@description Fired when the timeline is stopped before its end.

			If your listener prevents the default action (for instance, by
			returning false) the timeline will not stop.
		
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.anim.Timeline#event:complete
		@event
		@description Fired when the timeline ends.

			This event does not fire on looping timelines.
		
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.anim.Timeline#event:resume
		@event
		@description Fired when the timeline resumes after being stopped.

			If your listener prevents the default action (for instance, by
			returning false) the timeline will not resume.
		
		@param {glow.events.Event} event Event Object
		*/
		var timelineEventConstructorNames = ["onStart", "onStop", "onComplete", "onResume"];
		r.Timeline = function(channels, opts) {
			this._opts = opts = glow.lang.apply({
				loop: false,
				destroyOnComplete: false,
				onStart: null,
				onStop: null,
				onComplete: null,
				onResume: null
			}, opts);
			/*
			PrivateProperty: _channels
				Array of channels
			*/
			//normalise channels so it's always an array of array(s)
			this._channels = (channels[0] && channels[0].push) ? channels : [channels];
			/*
			PrivateProperty: _channelPos
				index of each currently playing animation
			*/
			this._channelPos = [];
			/*
			PrivateProperty: _playing
				Is the timeline playing?
			*/
			this._playing = false;

			/**
			@name glow.anim.Timeline#loop
			@type Boolean
			@description Inidcates whether the timeline loops.

				The "complete" event does not fire for looping animations.
				This can be set while a timeline is playing.
			*/
			this.loop = opts.loop;

			var i, j, iLen, jLen,
				channel,
				allChannels = this._channels,
				totalDuration = 0,
				channelDuration;

			//process channels
			for (i = 0, iLen = allChannels.length; i < iLen; i++) {
				channel = allChannels[i];
				channelDuration = 0;
				for (j = 0, jLen = channel.length; j < jLen; j++) {
					//create a blank animation for time waiting
					if (typeof channel[j] == "number") {
						channel[j] = new r.Animation(channel[j]);
					}
					if (channel[j] instanceof r.Animation) {
						if (! channel[j].useSeconds) {
							throw new Error("Timelined animations must be timed in seconds");
						}
						channel[j]._timelineOffset = channelDuration * 1000;
						channelDuration += channel[j].duration;
						channel[j]._channelIndex = i;
					}
				}
				/**
				@name glow.anim.Timeline#duration
				@type Number
				@description Length of the animation in seconds
				*/
				this.duration = totalDuration = Math.max(channelDuration, totalDuration);
			}
			/*
			PrivateProperty: _controlAnim
				This is used to keep the animation in time
			*/
			this._controlAnim = new r.Animation(totalDuration);
			events.addListener(this._controlAnim, "frame", this._processFrame, this);
			events.addListener(this._controlAnim, "complete", this._complete, this);
			
			// add events from constructor
			addEventsFromOpts(this, opts, timelineEventConstructorNames);
		};
		r.Timeline.prototype = {
			/*
			PrivateMethod: _advanceChannel
				Move to the next position in a particular channel
			*/
			_advanceChannel: function(i) {
				//is there a next animation in the channel?
				var currentAnim = this._channels[i][this._channelPos[i]],
					nextAnim = this._channels[i][++this._channelPos[i]];

				if (currentAnim && currentAnim._playing) {
					currentAnim._playing = false;
					events.fire(currentAnim, "complete");
					if (currentAnim._opts.destroyOnComplete) {
						currentAnim.destroy();
					}
				}
				if ((nextAnim) !== undefined) {
					if (typeof nextAnim == "function") {
						nextAnim();
						this._advanceChannel(i);
					} else {
						nextAnim.position = 0;
						nextAnim._channelIndex = i;
						events.fire(nextAnim, "start");
						nextAnim._playing = true;
					}
				}
			},
			_complete: function() {
				if (this.loop) {
					this.start();
					return;
				}
				this._playing = false;
				events.fire(this, "complete");
				if (this._opts.destroyOnComplete) {
					this.destroy();
				}
			},
			_processFrame: function() {
				var i, len, anim, controlAnim = this._controlAnim,
					msFromStart = (new Date().valueOf()) - controlAnim._timeAnchor;

				for (i = 0, len = this._channels.length; i < len; i++) {
					if (! (anim = this._channels[i][this._channelPos[i]])) { continue; }
					anim.position = (msFromStart - anim._timelineOffset) / 1000;
					if (anim.position > anim.duration) {
						anim.position = anim.duration;
					}
					anim.value = anim.tween(anim.position / anim.duration);
					events.fire(anim, "frame");
					if (anim.position == anim.duration) {
						this._advanceChannel(i);
					}
				}
			},

			/**
			@name glow.anim.Timeline#start
			@function
			@description Starts playing the timeline from the beginning.
			@returns this
			*/
			start: function() {
				var e = events.fire(this, "start");
				if (e.defaultPrevented()) { return this; }
				var i, iLen, j, jLen, anim;
				this._playing = true;
				for (i = 0, iLen = this._channels.length; i < iLen; i++) {
					this._channelPos[i] = -1;
					this._advanceChannel(i);
					for (j = this._channels[i].length; j; j--) {
						anim = this._channels[i][j];
						if (anim instanceof r.Animation) {
							anim.goTo(0);
						}
					}
				}
				this._controlAnim.start();
				return this;
			},

			/**
			@name glow.anim.Timeline#stop
			@function
			@description Stops the timeline.
			@returns this
			*/
			stop: function() {
				if (this._playing) {
					var e = events.fire(this, "stop");
					if (e.defaultPrevented()) { return this; }
					this._playing = false;
					var anim;
					for (var i = 0, len = this._channels.length; i<len; i++) {
						anim = this._channels[i][this._channelPos[i]];
						if (anim instanceof r.Animation && anim._playing) {
							events.fire(anim, "stop");
							anim._playing = false;
						}
					}
					this._controlAnim.stop();
				}
				return this;
			},
			
			/**
			@name glow.anim.Timeline#destroy
			@function
			@description Destroys the timeline & animations within it
				Call this on timeline you no longer need to free memory.
			@returns this
			*/
			destroy: function() {
				var i, j;
				// stop the animation in case it's still playing
				this.stop();
				events.removeAllListeners(this);
				this._controlAnim.destroy();
				
				// loop through all the channels
				i = this._channels.length; while (i--) {
					// loop through all the animations
					j = this._channels[i].length; while (j--) {
						// check it has a destroy method (making sure it's an animation & not a function)
						if (this._channels[i][j].destroy) {
							// DESTROYYYYY!
							this._channels[i][j].destroy();
						}
					}
				}
				return this;
			},

			/**
			@name glow.anim.Timeline#resume
			@function
			@description Resumes the timeline from wherever it was stopped.
			@returns this
			*/
			resume: function() {
				if (! this._playing) {
					var e = events.fire(this, "resume");
					if (e.defaultPrevented()) { return this; }
					this._playing = true;
					var anim;
					for (var i = 0, len = this._channels.length; i<len; i++) {
						anim = this._channels[i][ this._channelPos[i] ];
						if (anim instanceof r.Animation && !anim._playing) {
							events.fire(anim, "resume");
							anim._playing = true;
						}
					}
					this._controlAnim.resume();
				}
				return this;
			},

			/**
			@name glow.anim.Timeline#isPlaying
			@function
			@returns {Boolean}
			@description Returns true if the timeline is playing.
			*/
			isPlaying: function() {
				return this._playing;
			},
			
			/**
			@name glow.anim.Timeline#goTo
			@function
			@returns this
			@description Go to a specific point in the timeline
			@param {Number|glow.anim.Animation} pos Position in the timeline to go to.

				You can go to a specific point in time (in seconds) or provide
				a reference to a particular animation to begin at.

			@example
				var myTimeline = new glow.anim.Timeline([anim1, anim2]);
				
				//start the Timeline 2.5 seconds in
				myTimeline.goTo(2.5).resume();
				
			@example
				var myTimeline = new glow.anim.Timeline([anim1, anim2]);
				
				//start the Timeline from anim2
				myTimeline.goTo(anim2).resume();
			*/
			goTo: function(pos) {
				var i,
					j,
					k,
					channelsLen = this._channels.length,
					channelLen,
					// holding var for an anim
					anim,
					runningDuration;
				
				if (typeof pos == "number") {
					
					if (pos > this.duration) {
						// if the position is greater than the total, 'loop' the value
						if (this.loop) {
							pos = pos % this.duration;
						} else {
							pos = this.duration;
						}
					}
					
					// advance the control anim
					this._controlAnim.goTo(pos);
					
					// loop through the animations in all the channels, find out which
					// one to start playing from
					for (i = 0; i < channelsLen; i++) {

						runningDuration = 0;
						// go through animations in that channel
						for (j = 0, channelLen = this._channels[i].length; j < channelLen; j++) {
							anim = this._channels[i][j];
							
							if (anim instanceof r.Animation) {
								// we found an animation we should be playing
								if ( (runningDuration + anim.duration) > pos) {
									// record its position and leave the loop
									this._channelPos[i] = j;
									anim.goTo(pos - runningDuration);
									break;
								}
								// we're moving to a position where this animation has
								// finished playing, need to fire its final frame
								anim.goTo(anim.duration);
								// add that anim to the running total
								runningDuration += anim.duration;
							}
							
						}
						// right, now we need to move all animations after this
						// one to the start...
						for (k = channelLen; k > j; k--) {
							anim.goTo(0);
						}
					}
				} else {
					// ok, we've been provided with an object rather than a number of seconds
					// Let's convert it to seconds and rerun this function
					for (i = 0; i < channelsLen; i++) {
						// let's count this to find out what "time" the item the user wants to play is at
						runningDuration = 0;
						
						// let's loop through animations in that channel
						for (j = 0, channelLen = this._channels[i].length; j < channelLen; j++) {
							anim = this._channels[i][j];
							
							if (anim === pos) {
								// oh! We've found the thing they want to play
								return this.goTo(runningDuration);
							}
							if (anim instanceof r.Animation) {
								// add that anim to the running total
								runningDuration += anim.duration;
							}
						}
					}
					throw "Animation not found in animation channels";
				}
				return this;
			}
		};
		glow.anim = r;
	}
});
/**
	@name glow.forms
	@namespace
	@see <a href="../furtherinfo/forms/">Validating Forms</a>
	@see <a href="../furtherinfo/forms/defaultfeedback/">Using default form feedback</a>
	@see <a href="../furtherinfo/forms/example.shtml">Working example</a>
	@description Validating HTML Forms.
		To get started, you'll need to create a {@link glow.forms.Form Form instance}.
 */
(window.gloader || glow).module({
	name: "glow.forms",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", 'glow.dom', 'glow.events', 'glow.anim', 'glow.net', 'glow.i18n']],
	builder: function(glow) {

	var $i18n = glow.i18n,
		$interpolate = glow.lang.interpolate;

	$i18n.addLocaleModule("GLOW_FORMS", "en", {
		TEST_MESSAGE_REQUIRED  : "Value is required",
		TEST_MESSAGE_IS_NUMBER : "Must be a number.",
		TEST_MESSAGE_MIN       : "The value must be at least {arg}.",
		TEST_MESSAGE_MAX       : "The value must be less than {arg}.",
		TEST_MESSAGE_RANGE     : "The value must be {min} or greater, and less than {max}.",
		TEST_MESSAGE_MIN_COUNT : "Must be have at least {arg} values.",
		TEST_MESSAGE_MAX_COUNT : "Must be have at most {arg} values.",
		TEST_MESSAGE_COUNT     : "Must have {arg} values.",
		TEST_MESSAGE_REGEX     : "Must be in the correct format.",
		TEST_MESSAGE_MIN_LEN   : "Must be at least {arg} characters.",
		TEST_MESSAGE_MAX_LEN   : "Must be at most {arg} characters.",
		TEST_MESSAGE_IS_EMAIL  : "Must be a valid email address.",
		TEST_MESSAGE_SAME_AS   : "Must be the same as: {arg}",
		TEST_MESSAGE_AJAX      : "server responded",
		TEST_MESSAGE_IS        : "Must be {arg}",
		TEST_MESSAGE_IS_NOT    : "Must not be {arg}"
	});

glow.forms = {};

/**
	@name glow.forms.Form
	@constructor
	@description Create an object to add tests to.
	@see <a href="../furtherinfo/forms/">Validating Forms</a>
	@see <a href="../furtherinfo/forms/defaultfeedback/">Using default form feedback</a>
	@param {glow.dom.NodeList | Selector} formNode
	@param {Object} [opts]
	@param {Function} [opts.onValidate] Handles the 'validate' event when all tests are complete. Default is glow.forms.feedback.defaultFeedback.
	@example
	myForm = new glow.forms.Form(
		glow.dom.get("#htmlFormId"),
		{
			onValidate: function(results) {
				// ...
			}
		}
	);
 */
glow.forms.Form = function(formNode, opts) { /*debug*///console.log("glow.forms.Form#new("+formNode+", "+opts+")");
	/**
	@name glow.forms.Form#formNode
	@type glow.dom.NodeList
	@description NodeList containing the form element
	*/
	this.formNode = glow.dom.get(formNode);
	if (!this.formNode[0]) throw "Could not find form. Possibly run before DOM ready.";
	this._fields = [];
	this._result = null;
	this.opts = opts || {};
	glow.events.addListener(this, "validate", this.opts.onValidate || feedback.defaultFeedback);

	this._idleTimer = null;
	
	this._localeModule = $i18n.getLocaleModule("GLOW_FORMS");

	// add event listener to form
	var thisForm = this;
	glow.events.addListener(
		this.formNode,
		"submit",
		function() {
			thisForm.validate('submit');
			return false; // submit() will be called from the nextField method instead
		}
	);
}

/**
	@name glow.forms.Form#event:validate
	@event
	@description Fired whenever the glow tries to validate a form.
	
	If you prefer you can set a handler for this event via the <code>onValidate</code> option of the glow.forms.Form constructor.
	
	@param {glow.forms.ValidateResult} event A specialised Event object.
	@example
	
	glow.events.addListener(myForm, "validate", function(e) {
		if (e.eventName == 'submit') {
			if (e.errorCount == 0) { alert("Well done!"); }
			else { e.preventDefault(); } // stop the submit from happening
		}
	});
 */

/**
	@name glow.forms.Form#validate
	@function
	@description Run validation tests.
		This is called automatically depending on the tests added to the form.
		However, you can trigger validation manually
	@param {String} [eventName='submit'] Run only tests tied to this eventname.
	@param {String} [fieldName] Run only tests attached to the form element with this name.
 */
glow.forms.Form.prototype.validate = function(eventName, fieldName) { /*debug*///console.log("glow.forms.Form#validate("+eventName+", "+fieldName+")");
	this.eventName = eventName || 'submit'; // default
	this._result = new glow.forms.ValidateResult(this.eventName);
	this._result.form = this;

	this._fieldCur = 0;
	this._testCur = -1;

	this._fieldName = fieldName;
	nextTest.call(this);
}

/**
	Advance the test cursor to get the next test in the queue and then run it.
	@function
	@name nextTest
	@this {glow.forms.Form}
	@calledBy glow.forms.Form#validate
	@calledBy onTestResult
	@private
 */
var nextTest = function() { /*debug*///console.log("glow.forms.Form#nextTest()");
	this._testCur++;
	if (this._testCur >= this._fields[this._fieldCur]._tests.length) { // run out of tests for the current field?
		if (!nextField.call(this)) return;
	}

	var currentTest = this._fields[this._fieldCur]._tests[this._testCur]; // shortcut

	// get value from form element, normalize into an array
	var fieldValue;
	if (currentTest.opts.field) { // a conditional test
		fieldValue = this.formNode.val()[currentTest.opts.field] || "";
		currentTest.isConditional = true;
	}
	else {
		fieldValue = this.formNode.val()[this._fields[this._fieldCur].name] || "";
	}

	// values should always be an array
	if (!fieldValue.join) fieldValue = [fieldValue];

	var callback = function(that) { // closure
		return function() { onTestResult.apply(that, arguments) };
	}(this);

	// only run tests that are tied to the eventName being validated
	currentTest.opts.on = currentTest.opts.on || "submit";
	if (
		this._result.eventName
		&& (" "+currentTest.opts.on+" ").indexOf(" "+this._result.eventName+" ") != -1 // assume space delimited event names
	) {
		// skip tests that are not tied to the fieldName being validated
		if (this._fieldName && this._fieldName != currentTest.name) {
			nextTest.call(this);
			return;
		}

		// run the test, if it exists
		if (typeof glow.forms.tests[currentTest.type] != "function") {
			throw "Unimplemented test: no test exists of type '"+currentTest.type+"'.";
		}
		
		currentTest.opts._localeModule = this._localeModule;
		glow.forms.tests[currentTest.type](fieldValue, currentTest.opts, callback, this.formNode.val());
	}
	else {
		nextTest.call(this);
	}
}

/**
	Advance the field cursor to get the next field in the queue.
	@function
	@name nextField
	@this {glow.forms.Form}
	@calledBy glow.forms.Form#nextTest
	@private
 */
var nextField = function() { /*debug*///console.log("glow.forms.Form#nextField()");
	// start at the beginning of the next field
	this._fieldCur++;
	this._testCur = 0;

	if (this._fieldCur >= this._fields.length) { // run out of fields?
		this._fieldCur = 0;
		// ready to fire the validate event now
		glow.events.fire(this, "validate", this._result);
		
		if ( this.eventName == "submit" && this._result && !this._result.defaultPrevented() ) { // ready to submit now
			try {
				// we cannot initiate a form submit by simply returning true or false from
				// this event handler because there may be asynchronous tests still pending at this point,
				// so we must call submit ourselves, after the last field has finally been tested
				this.formNode[0].submit();
			}
			catch(e) {
				throw new Error("Glow can't submit the form because the submit function can't be called. Perhaps that form's submit was replaced by an input element named 'submit'?");
			}
		}
		
		return false; // don't keep going
	}

	return true; // do keep going
}

/**
	@name onTestResult
	@function
	@this {glow.forms.Form}
	@calledBy glow.forms.tests.*
	@param {Number} result One of: glow.forms.PASS, glow.forms.FAIL
	@param {String} message
	@private
 */
var onTestResult = function(result, message) { /*debug*///console.log("glow.forms.Form#onTestResult("+result+", "+message+")");
	// convert result from a boolean to glow.forms.FAIL / glow.forms.PASS
	if (typeof result == "boolean") result = (result)? glow.forms.PASS : glow.forms.FAIL;

	// a conditional test has failed?
	if (this._fields[this._fieldCur]._tests[this._testCur].isConditional && result === glow.forms.FAIL) {
		result = glow.forms.SKIP; // failure of a conditional test becomes a skip
	}

	this._result.fields.push(
		{
			name: this._fields[this._fieldCur].name,
			result: result,
			message: message
		}
	);

	if (result !== glow.forms.PASS) { // might be a fail or a skip
		if (result === glow.forms.FAIL) this._result.errorCount++;

		// skip over all further tests for this field
		this._testCur = this._fields[this._fieldCur]._tests.length;
	}

	nextTest.call(this);
}

/**
	@name glow.forms.Form#addTests
	@function
	@description Add one or more tests to a field.
	@param {String} fieldName The name of the field to add tests to.
	@param {Array} [spec]
	
		Test specifications identify the type of test to be run on a field to
		determine whether it contains desired data. See docs on the
		{@link glow.forms.tests types of tests}.
	
	@example
	//pattern for a test specification
	[
	  "testName", //name of the test to run
	  {
	    arg     : 5,                //an argument for the test, not all tests need this
	    on      : "submit change",  //when should this test be run?
	    message : "Incorrect value" //a custom error message to display
	  }
	]
	
	@example
	//setting a form up for validation
	var myForm = new glow.forms.Form(glow.dom.get("#myFormId"))
		.addTests(
			"username",
			["required"],
			["maxLen", {
				arg: 12,
				message: "Name must be les than 12 characters long."
			}]
		)
		.addTests(
			"email",
			["isEmail"]
		);
 */
glow.forms.Form.prototype.addTests = function(fieldName /*...*/) { /*debug*///console.log("glow.forms.Form#addTests("+fieldName+", ...)");
	var field = {name: fieldName, _tests:[]};

	var changeCallback = function(that) {
		return function() {
			that.validate.apply(that, ["change", fieldName])
		};
	}(this);

	var clickCallback = function(that) {
		return function() {
			that.validate.apply(that, ["click", fieldName])
		};
	}(this);

	var idleCallback = function(that) {
		return function() {
			that.validate.apply(that, ["idle", fieldName]);
		};
	}(this);

	// loop over test specifications
	for (var i = 1; i < arguments.length; i++) {
		var testType = arguments[i][0];
		var testOpts = (arguments[i].length > 1)? arguments[i][1] : {}; // default opts

		field._tests.push({name: fieldName, type: testType, opts: testOpts});

		// add event listeners to form fields for change events
		if (!changeCallback.added && (" "+testOpts.on+" ").indexOf(" change ") != -1) {
			var inputs = this.formNode.get("*").each(function (i) {
				if (this.name == fieldName) {
					glow.events.addListener(this, "change", changeCallback);
					changeCallback.added = true;
				}
			});
		}

		// add event listeners to form fields for click events
		if (!clickCallback.added && (" "+testOpts.on+" ").indexOf(" click ") != -1) {
			var inputs = this.formNode.get("*").each(function (i) {
				if (this.name == fieldName) {
					glow.events.addListener(this, "click", clickCallback);
					clickCallback.added = true;
				}
			});
		}

		if (!idleCallback.added && (" "+testOpts.on+" ").indexOf(" idle ") != -1) {
			var idleDelay = (typeof testOpts.delay != "undefined")? parseInt(testOpts.delay) : 1000; // default delay before idle handler is run

			var inputs = this.formNode.get("*").each(function (i) {
				if (this.name == fieldName) {
					// FIXME: adding idleTimeoutID to HTML element, is this the best way?
					glow.events.addListener(this, "keyup", function(t){ return function() {window.clearTimeout(this.idleTimeoutID); if (this.value) this.idleTimeoutID = window.setTimeout(idleCallback, t)} }(idleDelay));
					glow.events.addListener(this, "blur", function() {window.clearTimeout(this.idleTimeoutID)});

					idleCallback.added = true;
				}
			});
		}
	}

	this._fields.push(field);

	return this; // chained
}

/**
	@name glow.forms.ValidateResult
	@constructor
	@extends glow.events.Event
	@description The overall result returned by an attempt to validate the current state of the form.
	
	The ValidateResult object is used by glow.forms.Form to accumulate and record the test results as they are run. It is created automatically by the running validation so it is not necessary for the user to instantiate it directly, but it is useful to know the properties and their meanings as these will likely be referred to when a custom <code>onValidate</code> handler is run.
	@param {String} eventName
	@property {String} eventName The name of the event that was associated with this validation event.
	
	Validation can happen based on one of several different user interactions, this property allows you to identify the type of interaction that initiated this validation. Examples are:
	
		<dl>
			<dt>submit</dt>
			<dd>The user has done something to submit the form, for example by pressing the Submit button.</dd>
			<dt>change</dt>
			<dd>The user has modified the value of a form field.</dd>
			<dt>idle</dt>
			<dd>The user is typing in a form field but has paused for a moment (by default 1 second).</dd>
			<dt>click</dt>
			<dd>The user has clicked the mouse on or in a form field.</dd>
		</dl>
	
	Which user interaction is associated with which tests is determined by the options you used when you added the test. See the documentation for {@link glow.forms.Form#addTests} for more information. 
	
	@property {Object[]} fields Each object in this array has a name of a field, a test result such as glow.forms.PASS, glow.forms.FAIL or glow.forms.SKIP, and a message describing the test result.
	
	The effect of validation is that the value or state of each field in the form is compared to the tests the developer has added to the fields. In each tested field a determination is made that the current value either passes or fails (or, if the test wasn't run at all, is skipped). The <code>fields</code> property provides information on the overall result of the validation, on each field that was tested and the results.
	
	@property {Number} errorCount The number of fields that had a failing test.
	
	From the <code>fields</code> property you can determine how many fields have failing or passing values; this is property is simply a more convenient way to access the total failing count of tests that fail. If no tests fail then this value will be 0 and you can consider the form to have validated.
	
 */
glow.forms.ValidateResult = function(eventName) {
	glow.events.Event.apply(this);

	this.eventName = eventName;
	this.errorCount = 0;
	this.value = undefined;
	this.fields = [];
}

glow.lang.extend(glow.forms.ValidateResult, glow.events.Event);

/**
	@name glow.forms.PASS
	@type Number
	@description Constant for a passed test.
		This indicates that the value in a field passes all the tests associated with it. You can use this when creating {@link glow.forms.tests.custom custom tests}
 */
glow.forms.PASS =  1;
/**
	@name glow.forms.FAIL
	@type Number
	@description Constant for a failing test.
		This indicates that the value in a field fails at least one of the tests associated with it. You can use this when creating {@link glow.forms.tests.custom custom tests}
 */
glow.forms.FAIL =  0;
/**
	@name glow.forms.SKIP
	@type Number
	@description Constant for a skipped test.
		This indicates that there was some unmet condition associated with the applied tests, so they were not run. This state is not considered a fail, and will not affect glow.forms.ValidateResult#errorCount. You can use this when creating {@link glow.forms.tests.custom custom tests}.
 */
glow.forms.SKIP = -1;

/**
	@name glow.forms.tests
	@namespace
	@see <a href="../furtherinfo/forms/">Validating Forms</a>
	@see <a href="../furtherinfo/forms/example.shtml">Working example</a>
	@description Collection of built-in tests that can be added to any form field as a way of validating that field's value.

	<p>You do not need to call these functions directly, the devloper use a test by passing its name to the {@link glow.forms.Form#addTests addTests} method.</p>

	<p>For more information about tests, how to create your own custom tests, or to see what arguments these tests take, you may refer to the <a href="../furtherinfo/forms/#custom_tests">Creating
	Custom Tests</a> section of the Validating Forms user guide.</p>
 */
glow.forms.tests = {
	/**
		@name glow.forms.tests.required
		@function
		@description The value must contain at least one non-whitespace character.
		
		A text input field that is empty, or contains only spaces for example will fail this test.
		
		@example
		myForm.addTests(
			"fieldName",
			["required"]
		);
	 */
	required: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.required()");
		var message = opts.message || opts._localeModule.TEST_MESSAGE_REQUIRED;

		for (var i = 0, len = values.length; i < len; i++) {
			if (/^\s*$/.test(values[i])) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.isNumber
		@function
		@description The value must be a valid number.
		
		A field that is empty, or contains a value that is not a number like 1 or 3.14 will fail this test.
		
		@example
		myForm.addTests(
			"fieldName",
			["isNumber"]
		);
	 */
	isNumber: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.isNumber()");
		var message = opts.message || opts._localeModule.TEST_MESSAGE_IS_NUMBER;

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i] == "" || isNaN(values[i])) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.min
		@function
		@description The numeric value must be at least the given value.
		
		A field whose value, when converted to a number, is not less than the given arg will fail this test.
		
		@example
		myForm.addTests(
			"fieldName",
			["min", {
				arg: "1"
			}]
		);
	 */
	min: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.min()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MIN, {arg: opts.arg});
		for (var i = 0, len = values.length; i < len; i++) {
			if (Number(values[i]) < Number(opts.arg)) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.max
		@function
		@description The numeric value must be no more than the given value.
		
		A field whose value, when converted to a number, is not more than the given arg will fail this test.
		
		@example
		myForm.addTests(
			"fieldName",
			["max", {
				arg: "100"
			}]
		);
	 */
	max: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.max()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MAX, {arg: opts.arg});
		for (var i = 0, len = values.length; i < len; i++) {
			if (Number(values[i]) > Number(opts.arg)) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.range
		@function
		@description The numeric value must be between x..y.
		
		A field whose value, when converted to a number, is not more than x and less than y will fail this test.
		
		@example
		myForm.addTests(
			"fieldName",
			["range", {
				arg: "18..118"
			}]
		);
	 */
	range: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.range()");
		var minmax = opts.arg.split(".."); // like "0..10"
		if (typeof minmax[0] == "undefined" || typeof minmax[1] == "undefined") {
			throw "Range test requires a parameter like 0..10."
		}
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_RANGE, {min: minmax[0], max : minmax[1]});

		// cast to numbers to avoid stringy comparisons
		minmax[0] *= 1;
		minmax[1] *= 1;

		// reverse if the order is hi..lo
		if (minmax[0] > minmax[1]) {
			var temp = minmax[0];
			minmax[0] = minmax[1];
			minmax[1] = temp;
		}

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i] < minmax[0] || values[i] > minmax[1]) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.minCount
		@function
		@description There must be at least the given number of values submitted with this name.
			This is useful for multiple selects and checkboxes that have the same name.
		@example
		myForm.addTests(
			"fieldName",
			["minCount", {
				arg: "1"
			}]
		);
	 */
	minCount: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.minCount()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MIN_COUNT, {arg: opts.arg});

		var count = 0;

		for (var i = 0; i < values.length; i++ ) {
			if (values[i] != "") count++;
		}

		if (count < opts.arg) {
			callback(glow.forms.FAIL, message);
			return;
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.maxCount
		@function
		@description There must be no more than the given number of values submitted with this name.
			This is useful for multiple selects and checkboxes that have the same name.
		@example
		myForm.addTests(
			"fieldName",
			["maxCount", {
				arg: "10"
			}]
		);
	 */
	maxCount: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.maxCount()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MAX_COUNT, {arg: opts.arg});

		var count = 0;

		for (var i = 0; i < values.length; i++ ) {
			if (values[i] != "") count++;
		}

		if (count > opts.arg) {
			callback(glow.forms.FAIL, message);
			return;
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.count
		@function
		@description There must be exactly the given number of values submitted with this name.
			This is useful for multiple selects and checkboxes that have the same name.
		@example
		myForm.addTests(
			"fieldName",
			["count", {
				arg: "2"
			}]
		);
	 */
	count: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.count()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_COUNT, {arg: opts.arg});

		var count = 0;

		for (var i = 0; i < values.length; i++ ) {
			if (values[i] != "") count++;
		}

		if (count != opts.arg) {
			callback(glow.forms.FAIL, message);
			return;
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.regex
		@function
		@description The value must match the given regular expression.
		@example
		myForm.addTests(
			"fieldName",
			["regex", {
				arg: /^[A-Z0-9]*$/
			}]
		);
	 */
	regex: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.regex()");
		var message = opts.message || opts._localeModule.TEST_MESSAGE_REGEX;

		var regex = (typeof opts.arg == "string")? new RegExp(opts.arg) : opts.arg; // if its not a string assume its a regex literal
		for (var i = 0, len = values.length; i < len; i++) {
			if (!regex.test(values[i])) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.minLen
		@function
		@description The value must be at least the given number of characters long.
		@example
		myForm.addTests(
			"fieldName",
			["minLen", {
				arg: "3"
			}]
		);
	 */
	minLen: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.minLen()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MIN_LEN, {arg: opts.arg});

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i].length < opts.arg) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.maxLen
		@function
		@description The value must be at most the given number of characters long.
		@example
		myForm.addTests(
			"fieldName",
			["maxLen", {
				arg: "24"
			}]
		);
	 */
	maxLen: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.maxLen()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_MAX_LEN, {arg: opts.arg});

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i].length > opts.arg) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.isEmail
		@function
		@description The value must be a valid email address.
			This checks the formatting of the address, not whether the address
			exists.
		@example
		myForm.addTests(
			"fieldName",
			["isEmail"]
		);
	 */
	isEmail: function(values, opts, callback) { /*debug*///console.log("glow.forms.tests.isEmail()");
		var message = opts.message || opts._localeModule.TEST_MESSAGE_IS_EMAIL;

		for (var i = 0, len = values.length; i < len; i++) {
			if (!/^\s*[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\s*$/i.test(values[i])) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.sameAs
		@function
		@description The value must be the same as the value in the given field.
		@example
		myForm.addTests(
			"email_confirm",
			["sameAs", {
				arg: "email"
			}]
		);
	 */
	sameAs: function(values, opts, callback, formValues) { /*debug*///console.log("glow.forms.tests.sameAs()");
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_SAME_AS, {arg: opts.arg});
		var compareTo = formValues[opts.arg];

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i] != compareTo) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.ajax
		@function
		@description Send the data to the server for testing.
			A request to the given URL will be made and the response will be passed to the given callback.
			
			'arg' is the function to handle the response from the server.
			
			This function should return a truthy value to indicate whether the server 
			response should be considered a PASS or a FAIL. Optionally you can include a bespoke
			error message by returning an array of two elements, the first being
			the PASS or FAIL verdict, and the second being the error message to display.
			
			'url' is the url to call. You can use placeholders in here for form values (see example).
		@example
		
		myForm.addTests(
			"username",
			["ajax", {
				url: "/cgi/checkname.cgi?name={username}",
				arg: function (response) {
					if (response.text() == "OK") {
						return glow.forms.PASS;
					} else {
						return [glow.forms.FAIL, "That name is already taken."];
					}
				},
				message: "The server responded: that name is not permitted."
			}]
		);
	 */
	ajax: function(values, opts, callback, formValues) { /*debug*///console.log("glow.forms.tests.ajax() - "+opts.url);
		var queryValues = {},
		    message = (opts.message || opts._localeModule.TEST_MESSAGE_AJAX);
		    
		for (var p in formValues) {
			if (typeof formValues[p] == "string") {
				queryValues[p] = escape(formValues[p]);
			}
			else if (typeof formValues[p].push != "undefined") {
				queryValues[p] = glow.lang.map(formValues[p], function(i) { return escape(i); }).join(",");
			}
		}
		var url = glow.lang.interpolate(opts.url, queryValues);

		var request = glow.net.get(url, {
			onLoad: function(response) { /*debug*///console.log("glow.forms.tests.ajax - onLoad()");
				var verdict = opts.arg(response);
				if (typeof verdict.push == "undefined") verdict = [verdict, message];
				callback(verdict[0], verdict[1]);
			},
			onError: function(response) {
				alert("Error getting file: "+url);
			}
		});
	}
	,
	/**
		@name glow.forms.tests.custom
		@function
		@description Create a custom test.
		
			'arg' is a function which tests the form value.
			
			The function is given the following parameters:
			
			<dl>
				<dt>values</dt>
				<dd>
					An array of values submitted for that form field. If you
					are only expecting one value, it can be accessed via values[0]
				</dd>
				<dt>opts</dt>
				<dd>
					An object of any additional data included with the test
				</dd>
				<dt>callback</dt>
				<dd>
					This is a function used to tell Glow whether the test has
					passed or not. A callback is used rather than 'return' to
					allow async tests. The first parameter is either glow.forms.PASS
					or glow.forms.FAIL, the second is the success or failure message.
				</dd>
				<dt>formData</dt>
				<dd>
					This is an object of all values captured in the form.
				</dd>
			</dl>
		
		@example
		myForm.addTests(
			"username",
			["custom", {
				arg: function(values, opts, callback, formData) {
					for (var i = 0, len = values.length; i < len; i++) {
						if (values[i] == "Jake") {
							callback(glow.forms.FAIL, "The name Jake is not allowed.");
							return;
						}
					}
					callback(glow.forms.PASS, "Good name.");
				}
			}]
		);
	 */
	custom: function(values, opts, callback) {  /*debug*///console.log("glow.forms.tests.custom()");
		opts.arg.apply(this, arguments);
	}
	,
	/**
		@name glow.forms.tests.is
		@function
		@description The value must be equal to a particular value
		@example
		// this test ensures "other" is required *if* the "reason" field is equal to "otherReason"
		myForm.addTests(
			"other",
			["is", {
				field: "reason",
				arg: "otherReason"
			}],
			["required"]
		);
	 */
	"is": function(values, opts, callback) {
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_IS, {arg: opts.arg});

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i] != opts.arg) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
	,
	/**
		@name glow.forms.tests.isNot
		@function
		@description The value must not be equal to a particular value
		@example
		// you may have a dropdown select where the first option is "none" for serverside reasons
		myForm.addTests(
			"gender",
			["isNot", {
				arg: "none"
			}]
		);
	 */
	"isNot": function(values, opts, callback) {
		var message = opts.message || $interpolate(opts._localeModule.TEST_MESSAGE_IS_NOT, {arg: opts.arg});

		for (var i = 0, len = values.length; i < len; i++) {
			if (values[i] == opts.arg) {
				callback(glow.forms.FAIL, message);
				return;
			}
		}
		callback(glow.forms.PASS, message);
	}
}


/**
@name glow.forms.feedback
@namespace
@description Collection of functions for displaying validation results to the user

  <p>These functions should be used as handlers for {@link glow.forms.Form}'s validate event. At the
  moment there is only one provided handler, more may be added in the future.</p>

  <p>Of course, you don't have to use any of the methods here, you can provide your own.</p>

@see <a href="../furtherinfo/forms/defaultfeedback">Using the default form feedback</a>
*/

var feedback = glow.forms.feedback = {};

/**
@name glow.forms.feedback.defaultFeedback
@function
@description Default handler used by {@link glow.forms.Form}.

  <p>This method outputs messages to the user informing them which fields
  contain invalid data. The output is unstyled and flexible.</p>

@param {glow.forms.ValidateResult} result Object provided by the validate event

@see <a href="../furtherinfo/forms/defaultfeedback">Using the default form feedback</a>
*/
feedback.defaultFeedback = (function() {
	
	//a hidden form element used to update a screenreader's buffer
	var screenReaderBufferUpdater;
	
	//attempts to update the buffer of the screen reader
	function updateScreenReaderBuffer() {
		if (!screenReaderBufferUpdater) {
			screenReaderBufferUpdater = glow.dom.create('<input type="hidden" value="0" name="1.7.0" id="1.7.0" />').appendTo(document.body);
		}
		screenReaderBufferUpdater[0].value++;
	}
	
	//write out the messages which appear next to (or near) the fields
	function inlineErrors(response) {
		var fields = response.fields, //field test results
			fieldElm, //holder for the field element(s) being processed
			msgContainer, //holder for contextual message holder
			labelError, //error holder within label element
			i, len;

		for (i = 0, len = fields.length; i < len; i++) {
			fieldElm = glow.dom.get(response.form.formNode[0].elements[fields[i].name]);
			//here's where we get the error container, which is the label by default
			//also we need to escape invalid css chars CSS
			msgContainer = glow.dom.get("." + fields[i].name.replace(/(\W)/g, "\\$1") + "-msgContainer");
			if (!msgContainer[0] && fieldElm.length == 1) {
				//none found, try and get the label
				msgContainer = response.form.formNode.get("label").filter(function() { return this.htmlFor == fieldElm[0].id })
			}

			labelError = msgContainer.get("span.glow-errorMsg");

			if (fields[i].result) {
				//clear error messages & classes
				labelError.remove();
				fieldElm.removeClass("glow-invalid");
			} else {
				if (msgContainer.length) {
					//add the error span to the label if it isn't already there
					if (!labelError[0]) {
						msgContainer.append( (labelError = glow.dom.create('<span class="glow-errorMsg"></span>')) );
					}
					labelError.text(fields[i].message);
					fieldElm.addClass("glow-invalid");
				}
			}
		}
	}

	//write out a list of errors to appear at the top of the form
	function summaryError(response) {
		var fields = response.fields, //field test results
			fieldElm, //holder for the field element(s) being processed
			errorSummary, //div containing error summary
			errorList, //list of errors inside the error summary
			promptContainer, //holds the 'question' of the field
			prompt, //text to prefix each error line with
			i,
			len;

		//remove existing summary
		response.form.formNode.get("div.glow-errorSummary").remove();
		//create a summary div
		errorSummary = glow.dom.create('<div class="glow-errorSummary" tabindex="-1"><ul></ul></div>');
		errorList = errorSummary.get("ul");
		for (i = 0, len = fields.length; i < len; i++) {
			fieldElm = glow.dom.get(response.form.formNode[0].elements[fields[i].name]);
			promptContainer = glow.dom.get("." + fields[i].name.replace(/(\W)/g, "\\$1") + "-prompt");
			if (!promptContainer[0] && fieldElm.length == 1) {
				//we don't have a default, get the label
				promptContainer = response.form.formNode.get("label").filter(function() { return this.htmlFor == fieldElm[0].id })
			}
			//did we get a prompt container?
			if (promptContainer[0]) {
				//get rid of superflous content in the prompt container (such as errors)
				promptContainer.get("span.glow-errorMsg").remove();
				prompt = glow.lang.trim(promptContainer.text());
				if (prompt.slice(-1) == ":") {
					prompt = prompt.slice(0, -1);
				}
			} else {
				//else we just use the field name
				prompt = fields[i].name.replace(/^\w/, function(s) { return s.toUpperCase() } );
			}

			if (!fields[i].result) {
				errorList.append( glow.dom.create("<li></li>").text(prompt + ": " + fields[i].message) );
			}
		}
		response.form.formNode.prepend(errorSummary.css("opacity", "0"));
		glow.anim.css(errorSummary, "0.5", {
			opacity: {from: 0, to: 1}
		}, {tween: glow.tweens.easeOut()}).start();
		
		// if the error summary has been hidden, IE7 throws an exception here
		try {		
			errorSummary[0].focus();
		} catch (e) {}
		
		updateScreenReaderBuffer();
	}

	return function(response) {
		if (response.eventName == "submit") {
			//do we have any errors?
			if (!response.errorCount) {
				//remove existing summary
				response.form.formNode.get("div.glow-errorSummary").remove();
				return;
			}
			summaryError(response);
		}
		// display inline errors
		// we put this inside setTimeout to avoid an IE bug that can result
		// in the cursor appearing outside the form element
		setTimeout(function() {
			inlineErrors(response);
		}, 0);
		
		return false;
	}
}());

	}
});
/**
@name glow.embed
@namespace
@description Detect and embed Flash objects
@see <a href="../furtherinfo/embed/">Flash embedding</a>
*/
(window.gloader || glow).module({
	name: "glow.embed",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", "glow.dom", "glow.data", "glow.i18n"]],
	builder: function(glow) {

		var $i18n = glow.i18n;
		
		$i18n.addLocaleModule("GLOW_EMBED", "en", {
			FLASH_MESSAGE : "This content requires Flash Player version {min} (installed version: {installed})",
			NO_PLAYER_MESSAGE : "No Flash Flayer installed, or version is pre 6.0.0"
		});

		/**
		@name to_attributes
		@private
		@function
		@param object
		@returns attribute string suitable for inclusion within Flash embed/object tag
		@description converts a hash to a space delimited string of attribute assignments

			Simple values are assumed for the object properties, with the exception of
			'flashVars' which is treated as a special case. If 'flashVars' is itself an object,
			it will be serialised in querystring format.
			returns string representation of object as attribute assignments eg:
			{id:"myId",name:"my-name"}  becomes  'id="myId" name="my-name"'

		*/
		function to_attributes(object){

			var attributes = "";

			for (var $param in object){
				if ($param.toLowerCase() == "flashvars" && typeof object[$param] == "object"){
					attributes += ' FlashVars="' + glow.data.encodeUrl(object[$param]) + '"';
				}
				else {
					attributes += ' ' + $param + '="' + object[$param] + '"';
				}
			}
			return attributes;
		}

		/**
		@name toParams
		@private
		@function
		@param object
		@returns string of param tags or an object element
		@description converts a hash to a string of param tags

			Simple values are assumed for the object properties, with the exception of
			'flashVars' which is treated as a special case. If 'flashVars' is itself an object,
			it will be serialised in querystring format.
		*/
		function toParams(object) {
			var r = "",
				key,
				value;

			for (key in object) {
				if (key.toLowerCase() == "flashvars" && typeof object[key] == "object"){
					value = glow.data.encodeUrl(object[key]);
				} else {
					value = object[key];
				}

				r += '<param name="' + key + '" value="' + value + '" />\n';
			}
			return r;
		}

		/**
		@name _set_defaults
		@private
		@function
		@param target
		@param options
		@returns
		@description applies a hash of default property values to a target object

			Properties on the defaults object are copied to the target object if no such property is present.

		*/
		function _set_defaults(target,defaults){
			target = target || {};

			for (var param in defaults) {
				if (typeof target[param] == "undefined") {
					// is it safe to assign an object reference or should it be cloned ?
					target[param] = defaults[param];
				}
				else if (typeof defaults[param] == "object") {
					target[param] = _set_defaults(target[param],defaults[param]);
				}
			}

			return target;
		}

		/**
		 @name _platform
		 @private
		 @returns {string} 'win' or 'mac' or 'other'
		 @description identify the operating system
		 */
		function _platform(){
			var platform = (navigator.platform || navigator.userAgent);
			return platform.match(/win/i) ? "win" : platform.match(/mac/i) ? "mac" : "other";
		}

		/**
		@name _askFlashPlayerForVersion
		@private
		@function
		@param {Shockwave.Flash} flash_player a reference to an ActiveX Shockwave Flash player object
		@returns version object with structure: {major:n,minor:n,release:n,actual:"string"}
		@description returns flash_player version, as reported by the GetVariable("$version") method
		*/
		function _askFlashPlayerForVersion(flash_player){

			var $regexFLASH_VERSION = /^WIN (\d+),(\d+),(\d+),\d+$/;
			var $version = flash_player.GetVariable("$version");
			if ($match = $regexFLASH_VERSION.exec($version)){
				return {
					major 	: parseInt($match[1]),
					minor 	: parseInt($match[2]),
					release	: parseInt($match[3]),
					actual	: $version
				};
			}
			else {
				// throw an exception, something very strange going on if flash player returns version in any other format ?

			}
		}

		/**
		@name _getFlashPlayerVersion
		@private
		@function
		@returns version object with structure: {major:n,minor:n,release:n,actual:"string"}
		@description returns flash_player version

			Query installed Flash player version, using either ActiveX object creation (for Internet Explorer) or
			navigator plugins collection.

		*/
		function _getFlashPlayerVersion(){
			var $match, flash_player, NO_FLASH = {major : 0, minor : 0, release : 0}, result = NO_FLASH;
			
			if (glow.env.ie){
				try {
					flash_player = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.7");
					result = _askFlashPlayerForVersion(flash_player);
				}
				catch(e){
					// Version 6 needs kid-glove treatment as releases 21 thru 29 crash if GetVariable("$version") is called
					try {
						flash_player = new ActiveXObject("ShockwaveFlash.ShockwaveFlash.6");
						try {
							// This works from release 47 onward...(first public release after 29)
							flash_player.AllowScriptAccess = "always";
							result = _askFlashPlayerForVersion(flash_player);
						}
						catch(e){
							// we cannot safely test between releases 21...29, so assume the latest and hope for the best...
							result = {major:6,minor:0,release:29};
						}
					}
					catch (e){
						// nothing more we can do, either no flash installed, flash player version is ancient or ActiveX is disabled
					}
				}
			}
			else {
				var regexFLASH_VERSION = /^Shockwave Flash\s*(\d+)\.(\d+)\s*\w(\d+)$/;

				if ((flash_player = navigator.plugins["Shockwave Flash"]) && ($match = regexFLASH_VERSION.exec(flash_player.description))){
					result = {
						major 	: parseInt($match[1]),
						minor 	: parseInt($match[2]),
						release	: parseInt($match[3]),
						actual	: flash_player.description
					};
				}
			}

			result.toString = function(){return this.major ? [this.major,this.minor,this.release].join(".") : $i18n.getLocaleModule("GLOW_EMBED").NO_PLAYER_MESSAGE};

			return result;

		}

		/**
		 @name installed_flash_player
		 @private
		 @description version of installed Flash player, initialised at startup.
		 */
		var installed_flash_player = _getFlashPlayerVersion();


		/**
		@name _meetsVersionRequirements
		@private
		@function
		@param {string|object} requiredVersion string or version object

		 	major version must be specified. minor version is optional. release is optional, but both major and
		 	minor versions must also be supplied if release is specified.
		 	eg, as string:  "9.0.0",  "9.1",  "9"
		 	or, as object:  {major:9,minor:0,release:0},  {major:9,minor:0}, {major:9}

		@returns {boolean}.
		@description returns true if installed Flash player version meets requested version requirements

		*/
		function _meetsVersionRequirements(requiredVersion){

			if (typeof requiredVersion != "object"){
				var match = String(requiredVersion).match(/^(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/);
				if (!match){
					throw new Error('glow.embed._meetsVersionRequirements: invalid format for version string, require "n.n.n" or "n.n" or simply "n" where n is a numeric value');
				}

				requiredVersion = {
					major   : parseInt(match[1],10),
					minor   : parseInt(match[2]||0,10),
					release : parseInt(match[3]||0,10)
				}
			}

			var v = installed_flash_player, rv = requiredVersion;

			// return true if we meet the minimum version requirement...
			return (v.major > rv.major ||
			   (v.major == rv.major && v.minor > rv.minor) ||
			   (v.major == rv.major && v.minor == rv.minor && v.release >= rv.release));

		}

		/**
		@name _wrap_embedding_tag
		@private
		@function
		@param {string} src
		@param {object} attributes Hash of attributes to be included
		@param {string} params Hash of params to be included. These will be included as attributes for all but IE
		@returns {string} object or embed tag
		@description returns a complete object or embed tag, as appropriate (ie browser dependent)
		*/
		var _wrap_embedding_tag = glow.env.ie ? _wrap_object_tag : _wrap_embed_tag;
		function _wrap_embed_tag(src, attributes, params){
			return '<embed type="application/x-shockwave-flash" src="' + src + '"' + to_attributes(attributes) + to_attributes(params) + '></embed>';
		}
		function _wrap_object_tag(src, attributes, params){
			return '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" ' + to_attributes(attributes) + '><param name="movie" value="' + src + '" />' + toParams(params) + '</object>';
		}

		var r = {},
			idIndex = 0; // Used with private function _getId()

		/**
		@name _getId()
		@private
		@function
		@returns {string} unique string to use for id of a flash object
		@description Returns a unique to the page string to use for the id of the flash object.  This function ensures that all flash objects embedded into the page get an id.
		*/
		function _getId() {
			return glow.UID + "FlashEmbed" + (idIndex++);
		}

		/**
		@name glow.embed.Flash
		@class
		@description A wrapper for a Flash movie so it can be embedded into a page
		@see <a href="../furtherinfo/embed/">Flash embedding</a>

		@param {String} src Absolute or relative URL of a Flash movie file to embed
		@param {selector | glow.dom.NodeList} container The element to embed the movie into

			<p>If a CSS selector is provided then the first matching element is used as the
			container.</p>

		   	<p>If the parameter is a {@link glow.dom.NodeList}, then the first
		   	element of the list is used as the container.</p>

		@param {String|Object} minVersion The minimum required version of the Flash plugin.

			<p>The Flash plugin has a version numbering scheme comprising of  major, minor and
			release numbers.</p>

			<p>This param can be a string with the major number only, major plus minor numbers, or
			full three-part version number, e.g. "9",  "9.1" , "6.0.55" are all valid values.</p>

			<p>If minVersion is set as an object, it must use a similar structure to the object
			returned by the {@link glow.embed.Flash#version} method, e.g: <code>{major: 9, minor:0,
			release:0}</code>.</p>

		@param {Object} [opts]

			Hash of optional parameters.

			@param {String} [opts.width] Width of the Flash movie. Defaults to "100%"
			@param {String} [opts.height] Height of the Flash movie. Defaults to "100%"
			@param {String} [opts.id] Unique id to be assigned to Flash movie instance.
			@param {String} [opts.className] CSS class to be assigned to the embedding element.
			@param {Object} [opts.attributes] A hash of attributes to assign to the embedded element tag.
			@param {Object} [opts.params] A hash of optional Flash-specific parameters.
				For example quality, wmode, bgcolor, flashvars.
		 	@param {String|Function} [opts.message] Error handling message or function.

		 		A message to display in the event that the Flash player is either not
		 		installed or is an earlier version than the specified minVersion. This message will
		 		be written into the container element instead of the Flash movie.

		 		If a function is supplied, it will be invoked and any return value will be used
		 		as the message to write into the container.

		 	@example
				var myFlash = new glow.embed.Flash("/path/to/flash.swf", "#flashContainer", "9");

			@example
				var myFlash = new glow.embed.Flash("/path/to/flash.swf", "#flashContainer", "9", {
					width: "400px",
					height: "300px"
				});

			@example
				var myFlash = new glow.embed.Flash("/path/to/flash.swf", "#flashContainer", "9", {
					width: "400px",
					height: "300px",
					params: {
						wmode: "transparent",
						flashvars: {
							navColour: "red",
							username: "Frankie"
						}
					}
				});
		 */
		r.Flash = function(src, container, minVersion, opts){

			opts = _set_defaults(opts,{
					width	: "100%",
					height	: "100%",
					params  : {
						allowscriptaccess	: "always",
						allowfullscreen		: "true",
						quality				: "high"
					},
					attributes : {},
					//expressInstall : false, // TODO add this in a later release
					message : glow.lang.interpolate($i18n.getLocaleModule("GLOW_EMBED").FLASH_MESSAGE, {min: minVersion, installed: installed_flash_player}),
					// create a default ID one hasn't been created as an attribute
					id : (opts && opts.attributes && opts.attributes.id) || _getId() // Fix for trac 165
				}
			);

			/**
			 @name glow.embed.Flash#container
			 @type glow.dom.NodeList
			 @description The element containing the embedded movie.
			 */
			container = glow.dom.get(container);
			if (!container.length){
				throw new Error("glow.embed.Flash unable to locate container");
			}
			this.container = container;

			//this.expressInstall = opts.expressInstall; // TODO add this in a later release

			/**
			 @name glow.embed.Flash#movie
			 @type Element
			 @description A reference to the actual Flash movie element, for direct script access.
			 @example
				myFlash.movie.exposedFlashMethod();
			 */
			this.movie = null;

			this._displayErrorMessage = typeof opts.message == "function" ? opts.message : function(){return opts.message};

			/**
			 @name glow.embed.Flash#isSupported
			 @type Boolean
			 @description Does the user have the correct version of Flash?
				This will be false if the user has an earler version of Flash
				installed than this movie requires, or the user doesn't have
				any version of Flash instaled.
			 @example
				if ( !myFlash.isSupported ) {
					alert('Please download the latest version of Flash');
				}
			*/
			this.isSupported;

			// Check that the min version requirement is satisfied and store this status, so we don't later try to embed the thing
			// if we don't can't meet the version requirements.

			if (this.isSupported = _meetsVersionRequirements(minVersion)){
				var attrs = opts.attributes,
					overwrites = ["id", "width", "height"],
					i = overwrites.length;

				// copies stuff like opts.id to attr.id
				while (i--) {
					if (opts[overwrites[i]]) { attrs[overwrites[i]] = opts[overwrites[i]]; }
				}

				if (opts.className) { attrs["class"] = opts.className; }
				this._embed_tag = _wrap_embedding_tag(src, attrs, opts.params);
			}
			/*
			else if (this.expressInstall && _meetsVersionRequirements("6.0.65") && _platform().match(/^win|mac$/)) {

				// Callback to be invokes in case of express install error
				window[glow.UID + "flashExpressInstallCancelled"] = function(){
					alert("Flash update cancelled");
				}
				window[glow.UID + "flashExpressInstallFailed"] = function(){
					alert("Unable to complete update, please go to adobe.com...");
				}
				window[glow.UID + "flashExpressInstallComplete"] = function(){

					alert("New version of flash installed");

				}

				new glow.embed.Flash("expressInstall.swf",
					this.container,
					"6.0.65", {
					//TODO check minimum width/height
						width:opts.width,
						height:opts.height,
						params : {
							flashVars : {
								MMredirectURL :  window.location.toString(),
								MMplayerType : glow.env.ie ? "ActiveX" : "PlugIn",
								MMdoctitle : document.title,
								GlowCallback : glow.UID + "flashExpressInstall"
							}
						}
					}
				).embed();

				this.expressInstalling = true;
			}*/
		};

		/**
		 @name glow.embed.Flash.version
		 @function
		 @description Get details of the current users Flash plugin
		 @returns An object with details of the currently installed Flash plugin.

		 	<dl>
		 		<dt>major (number)</dt><dd>Flash player major version mumber</dd>
		 		<dt>minor (number)</dt><dd>Flash player minor version mumber.</dd>
		 		<dt>release (number)</dt><dd>Flash player release version mumber.</dd>
		 		<dt>actual (string)</dt><dd>The Flash version exactly as reported by the Flash player.</dd>
		 		<dt>toString (function)</dt><dd>toString implementation in the form "major.minor.release" Eg "9.0.2"</dd>
		 	</dl>

		@example
			var version = glow.embed.Flash.version();
			alert("curr = " + version.major) // "curr = 9"
			alert("curr = " + version) // "curr = 9.0.2"
		 */
		r.Flash.version = function(){
			return installed_flash_player;
		};

		/**
		 @name glow.embed.Flash#embed
		 @function
		 @description Embed the Flash movie into the document
		 @returns {glow.embed.Flash}

		 @example
		 	var myFlash = new glow.embed.Flash(...);
		 	myFlash.embed();
		*/
		r.Flash.prototype.embed = function(){
			var containerElm = this.container[0];
			if (this.isSupported){

				containerElm.innerHTML = this._embed_tag;

				this.movie = containerElm.firstChild;

			}/*
			else if (this.expressInstalling){
				// wait for expressInstall to complete

			}*/
			else {
				var message = this._displayErrorMessage();
				if (message){
					containerElm.innerHTML = message;
				}
			}

			return this;

		};

		glow.embed = r;

	}
});
/**
@name glow.dragdrop
@namespace
@description Simplifying drag and drop behaviour
*/
(window.gloader || glow).module({
	name: "glow.dragdrop",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", "glow.tweens", "glow.events", "glow.dom", "glow.anim"]],
	builder: function(glow) {
		var events		   = glow.events,
			addListener	   = events.addListener,
			fire		   = events.fire,
			removeListener = events.removeListener,
			dom			   = glow.dom,
			$			   = dom.get,
			create		   = dom.create;

		//public
		var r = {},
			_zIndex = 1000,
			_ieStrict = (document.compatMode == "CSS1Compat" && glow.env.ie >= 5) ? true : false,
			_ieTrans= (document.compatMode != "CSS1Compat" && glow.env.ie >= 5) ? true : false,
			_ie = glow.env.ie >= 5,
			sides = ['top', 'right', 'bottom', 'left'];

		/*
		PrivateFunction: memoize(clss, name)

		Replace a method with a version that caches the result after the first run.

		Arguments:

			*clss* (function)

			The class whose method is being memoized.

			*name*

			The name of the method to memoize.
		*/

		function memoize (clss, name) {
			var orig = clss.prototype[name];
			var cachedName = 'cached_' + name;
			clss.prototype[name] = function () {
				if (cachedName in this) return this[cachedName];
				return this[cachedName] = orig.apply(this, arguments);
			};
		}
		
		/*
		 Copy margins from one element to another
		*/
		function copyMargins(to, from) {
			var i = sides.length, margin;
			
			while (i--) {
				margin = 'margin-' + sides[i];
				to.css(margin, from.css(margin));
			}
		}

		/*
		PrivateFunction: memoizeNamed(clss, methodName)

		Replace a method that takes a name with a version that caches the result for each name after the first run.

		Arguments:

			*clss* (function)

			The class whose method is being memoized.

			*methodName*

			The name of the method to memoize.
		*/

		function memoizeNamed (clss, methodName) {
			var orig = clss.prototype[methodName];
			var cachedName = 'cached_' + methodName;
			clss.prototype[methodName] = function (name) {
				if (! this[cachedName]) this[cachedName] = {};
				if (name in this[cachedName]) return this[cachedName][name];
				return this[cachedName][name] = orig.apply(this, arguments);
			};
		}

		/*
		PrivateFunction: reset(obj, names)

		Remove cached values for a set of memoized methods.

		Arguments:

			*obj* (object)

			The object containing cached values.

			*names* (array of strings)

			The names of methods whose values have been cached.
		*/

		function reset (obj, names) {
			for (var i = 0, l = names.length; i < l; i++) {
				delete obj['cached_' + names[i]];
			}
		}

		/*
		PrivateFunction: resetNamed(obj, meth, names)

		Remove cached values for a set of named properties for a method.

		Arguments:

			*obj* (object)

			The object containing cached values.

			*meth* (string)

			The name of the method whose values have been cached.

			*names* (array of strings)

			The names of the cached properties.

		function resetNamed (obj, meth, names) {
			var cache = obj['cached_' + meth];
			if (! cache) return;
			for (var i = 0, l = names.length; i < l; i++) {
				delete cache[names[i]];
			}
		}
		*/

		/*
		PrivateClass: Box

		Calculates and caches information about an element in the box model.

		Constructor:

			 (code)
			 new Box(el)
			 (end)

		Arguments:

			*el* (glow.dom.NodeList)

			The element that calculations will be performed on.
		*/

		var Box = function (el) {
			this.el = el;
		};

		Box.prototype = {

			/*
			PrivateMethod: val

			Get an pixel value for a CSS style.

			Arguments:

				*style* (string)

				The name of a CSS style (e.g. "margin-top".

			Returns:
				An integer number of pixels.
			*/

			val: function (style) {
				var val = parseInt(this.el.css(style));
				// TODO - fix dom so margin-left return value is always defined?
//				if (isNaN(val)) throw 'got NaN in val for ' + style + ': ' + this.el.css(style);
				return val || 0;
//				return val;
			},

			/*
			PrivateMethod: width

			Get the width of the element.

			Returns:
				An integer number of pixels.
			*/

			width: function () {
				return this.borderWidth()
					 - this.val('border-left-width')
					 - this.val('border-right-width');
			},

			/*
			PrivateMethod: height

			Get the height of the element.

			Returns:
				An integer number of pixels.
			*/

			height: function () {
				return this.borderHeight()
					 - this.val('border-top-width')
					 - this.val('border-bottom-width');
			},

			/*
			PrivateMethod: offsetParentPageTop

			Get the number of pixels from the top of nearest element with absolute, relative or fixed position to the
			top of the page.

			Returns:
				An integer number of pixels.
			*/
			offsetParentPageTop: function () {
				var el = this.el[0], pos, top;
				while (el = el.offsetParent) {
					if ( $(el).css('position') != 'static' ) {
						break;
					}
				}
				return el ?
					$(el).offset().top :
					0;
			},

			/*
			PrivateMethod: offsetTop

			This gets what CSS 'top' would be if the element were position "absolute"

			Returns:
				An integer number of pixels.
			*/
			offsetTop: function () {
				return this.el.position().top;
			},

			/*
			PrivateMethod: offsetLeft

			This gets what CSS 'left' would be if the element were position "absolute"

			Returns:
				An integer number of pixels.
			*/
			offsetLeft: function () {
				return this.el.position().left;
			},

			/*
			PrivateMethod: borderWidth

			Get the width of the element from the left edge of the left border to the right
			edge of the right border.

			Returns:
				An integer number of pixels.
			*/

			borderWidth: function () {
				var width = this.el[0].offsetWidth;
				if (glow.env.khtml) {
					width -= this.val('margin-left')
							+ this.val('margin-right')
							+ this.val('border-left-width')
							+ this.val('border-right-width');
				}
				return width;
			},

			/*
			PrivateMethod: borderHeight

			Get the height of an element from the top edge of the top border to the bottom
			edge of the bottom border.

			Returns:
				An integer number of pixels.
			*/

			borderHeight: function () {
				if (this._logicalBottom) {
					return this._logicalBottom - this.offsetTop();
				}
				var height = this.el[0].offsetHeight;
				if (glow.env.khtml) {
					height -= this.val('margin-top')
							+ this.val('margin-bottom')
							+ this.val('border-top-width')
							+ this.val('border-bottom-width');
				}
				return height;
			},


			/*
			PrivateMethod: outerWidth

			Get the width of the element in including margin, borders and padding.

			Returns:
				An integer number of pixels.
			*/

			outerWidth: function () {
				return this.borderWidth() + this.val('margin-left') + this.val('margin-right');
			},

			/*
			PrivateMethod: outerHeight

			Get the height of the element in including margin, borders and padding. This
			does not take account of collapsable margins (i.e. it assumes the margins are
			present).

			Returns:
				An integer number of pixels.
			*/

			outerHeight: function () {
				return this.borderHeight() + this.val('margin-top') + this.val('margin-bottom');
			},

			/*
			PrivateMethod: innerLeftPos

			Get the offset of the left edge of the content of the box (i.e. excluding
			margin, border and padding).

			Returns:
				An integer number of pixels.
			*/

			innerLeftPos: function () {
				return this.offsetLeft()
					 + this.val('margin-left')
					 + this.val('border-left-width')
					 + this.val('padding-left');
			},

			/*
			PrivateMethod: innerTopPos

			Get the offset of the top edge of the content of the box (i.e. excluding
			margin, border and padding).

			Returns:
				An integer number of pixels.
			*/

			innerTopPos: function () {
				return this.offsetTop()
					 + this.val('margin-top')
					 + this.val('border-top-width')
					 + this.val('padding-top');
			},

			/*
			PrivateMethod: surroundWidth

			Get the combined width of the horizontal margins, borders and paddings.

			Returns:
				An integer number of pixels.
			*/

			surroundWidth: function () {
				return this.val('border-left-width')
					 + this.val('padding-left')
					 + this.val('padding-right')
					 + this.val('border-right-width');
			},

			/*
			PrivateMethod: surroundHeight

			Get the combined height of the horizontal margins, borders and paddings.

			Returns:
				An integer number of pixels.
			*/

			surroundHeight: function () {
				return this.val('border-top-width')
					 + this.val('padding-top')
					 + this.val('padding-bottom')
					 + this.val('border-bottom-width');
			},

			/*
			PrivateMethod: verticalCenter

			Get the vertical offset of the center of the element from it's offset parent.

			Returns:
				An integer number of pixels.
			*/

			verticalCenter: function () {
				return this.offsetTop() + (this.outerHeight() / 2);
			},

			/*
			PrivateMethod: verticalCenter

			Get the vertical offset of the center of the element from it's offset parent.

			Returns:
				An integer number of pixels.
			*/

			horizontalCenter: function () {
				return this.offsetTop() + (this.outerWidth() / 2);
			}

   		};

		for (var i in Box.prototype) {
			if (i == 'val') memoizeNamed(Box, i);
			else memoize(Box, i);
		}

		glow.lang.apply(Box.prototype, {

			/*
			PrivateMethod: resetPosition

			Reset cached position values for the element.
			*/

			resetPosition: function () {
				reset(this, [
					'offsetTop',
					'offsetLeft',
					'borderTopPos',
					'borderLeftPos',
					'innerTopPos',
					'innerLeftPos',
					'verticalCenter',
					'horizontalCenter'
				]);
			},

			/*
			PrivateMethod: setLogicalBottom

			Set the logical value for the position of the bottom of the border (offsetTop + offsetHeight).

			Arguments:

				*bottom* (integer)

				The value to use for the bottom of the box.
			*/
			setLogicalBottom: function (bottom) {
				this._logicalBottom = bottom;
			},

			/*
			PrivateMethod: boundsFor

			Get the the bounds for the left and top css properties of a child box to
			ensure that it stays within this element.

			Arguments:

				*childBox* (Box)

				A Box object representing the space taken up by the child element.

			Returns:
				An array of top, right, bottom and left pixel bounds for the top and left
				css properties of the child element.
			*/

			boundsFor: function (childBox) {
				var top, left, pos = this.el.css('position');
				if (pos != 'static') {
				    top = left = 0;
				}
				else {
					top = this.innerTopPos();
					left = this.innerLeftPos();
				}
				return [
					top,										   // top
					left + this.width() - childBox.outerWidth(),   // right
					top  + this.height() - childBox.outerHeight(), // bottom
					left										   // left
				];
			},

			/*
			PrivateMethod: outerBounds

			Get the top, right, bottom and left offsets of the outside edge of the border
			of the box.

			Returns:
				An array of integer pixel offsets for the top, right, bottom, left edges of the
				boxes border.
			*/

			outerBounds: function () {
				var offset = this.el.offset(),
					left = offset.left,
					top = offset.top;
				return [
					top,
					left + this.borderWidth(),
					top + this.borderHeight(),
					left
				];
			},

			/*
			PrivateMethod: intersectSize

			Get the intersection of this box with another box.

			Arguments:

				*that* (Box)

				A Box object to test for intersection with this box.

				*touches* (boolean)

				If true, then the boxes don't have to intersect but can merely touch.

			Returns:
				An integer number of square pixels that the the outside of the
				edge of the border of this box intersects with that of the passed
				in box.
			*/

			intersectSize: function (that, touches) {
				var a = this.outerBounds(), b = that.outerBounds();
				
				if (touches) {
					a[1]++; b[1]++; a[2]++; b[2]++;
				}
				return (
					a[2] < b[0] ? 0 :
					b[2] < a[0] ? 0 :
					a[0] < b[0] ? (a[2] < b[2] ? a[2] - b[0] : b[2] - b[0]) :
					b[2] < a[2] ? b[2] - a[0] : a[2] - a[0]
				) * (
					a[1] < b[3] ? 0 :
					b[1] < a[3] ? 0 :
					a[3] < b[3] ? (a[1] < b[1] ? a[1] - b[3] : b[1] - b[3]) :
					b[1] < a[1] ? b[1] - a[3] : a[1] - a[3]
				);
			},

			/*
			PrivateMethod: sizePlaceholder

			Size and position a placeholder/drop indicator element to match that
			of the element.

			Arguments:

				*placeholder* (glow.dom.NodeList)

				The element that will be sized.

				*pos* (optional string)

				The value for the placeholder's CSS position. Defaults to the position
				of this element.

				*startLeft* (integer)

				The original left position of the element.

				*startTop* (integer)

				The original top position of the element.
			*/

			sizePlaceholder: function (placeholder, pos, startLeft, startTop) {
				var placeholderBox = new Box(placeholder),
					el = this.el,
					position = pos || el.css('position');
				
				placeholder.css('display', 'none');
				
				el.after(placeholder);
				
				placeholder.css('width', (el[0].offsetWidth - placeholderBox.surroundWidth()) + 'px')
					.css('height', (el[0].offsetHeight - placeholderBox.surroundHeight()) + 'px');
				
				// copy margin values
				copyMargins(placeholder, el);
				
				placeholder.remove();
				
				placeholder.css('display', 'block');
				
				if (position != 'static') {
					placeholder.css('left', startLeft + 'px');
					placeholder.css('top', startTop + 'px');
				}
				placeholder.css('position', position);
			},

			/*
			PrivateMethod: contains

			Check if a box is contained within this box.

			Arguments:

				*box* (Box)

				The box to test.

			Returns:
				Boolean, true if contained.
			*/

			contains: function (box) {
				var bounds = this.boundsFor(box),
					position = box.el.position(),
					top = position.top,
					left = position.left;
				
				return top  >= bounds[0]  // top
					&& left <= bounds[1]  // right
					&& top  <= bounds[2]  // bottom
					&& left >= bounds[3]; // left
			},

			/*
			PrivateMethod: containsPoint

			Arguments:

				*offset* (object)

				The offset to check - an object containing x and y integer pixel values.

			Returns:
				Boolean, true if the point over the visible part of the element (i.e. including the borders).
			*/

			containsPoint: function (offset) {
				var elementOffset = this.el.offset();
				return offset.x >= elementOffset.left
					&& offset.y >= elementOffset.top
					&& offset.x <= elementOffset.left + this.borderWidth()
					&& offset.y <= elementOffset.top  + this.borderHeight();
			},

			/*
			PrivateMethod: positionedAncestorBox

			Get a new Box for nearest ancestor of the element that has position 'absolute', 'fixed' or 'relative'.

			Returns:
				An integer pixel offset.
			*/

			positionedAncestorBox: function () {
				var el = this.el.parent(), pos;
				while (el[0]) {
					pos = el.css('position') || 'static';
					if (pos == 'relative' || pos == 'absolute' || pos == 'fixed')
						return new Box(el);
					el = el.parent();
				}
				return null;
			}
		});

		function placeholderElement (el) {
			var tag = el[0].tagName.toLowerCase() == 'li' ? 'li' : 'div';
			var placeholder = create('<' + tag + '></' + tag + '>');
			if (tag == 'li') placeholder.css('list-style-type', 'none');
			return placeholder;
		}

		/**
		@name glow.dragdrop.Draggable
		@class
		@description An element that can be dragged using the mouse.
		@see <a href="../furtherinfo/dragdrop/draggables.shtml">Draggable examples</a>

		@param {String | Element | glow.dom.NodeList} element The element or CSS selector for an element to be made draggable.

			If a {@link glow.dom.NodeList NodeList} or CSS selector matching
			multiple elements is passed only the first element is made draggable.

		@param {Object} [opts]

			An object of options.

			The opts object allows you to pass in functions to use as event
			listeners. This is purely for convenience, you can also use
			{@link glow.events.addListener} to add them the normal way.

		@param {String} [opts.placeholder=spacer] Defines what to leave in place of the draggable whilst being dragged.

			Possible values for this param are:

			<dl>
			<dt>spacer</dt><dd>an empty div is created where the draggable started.</dd>
			<dt>clone</dt><dd>an exact clone of the original element.</dd>
			<dt>none</dt><dd>no placeholder will be created.</dd>
			</dl>

		@param {String} [opts.placeholderClass=glow-dragdrop-placeholder] A class be applied to the placeholder element.

			This can be used to to add styling for indicating where the element
			has been dragged from, add opacity, etc.

		@param {Selector | Element | glow.dom.NodeList} [opts.handle] Restrict the drag 'handle' to an element within the draggable.

		@param {Selector | Element | glow.dom.NodeList} [opts.container] Constrain dragging to within the bounds of the specified element.

		@param {Array} [opts.dropTargets] An array of {@link glow.dragdrop.DropTarget DropTargets}.

			Specifies which {@link glow.dragdrop.DropTarget DropTargets} this draggable is associated with.

		@param {String} [opts.axis] Restrict dragging to an axis.

			Possible values for this param are:

			<dl>
			<dt>x</dt><dd>Restricts dragging to the x-axis</dd>
			<dt>y</dt><dd>Restricts dragging to the y-axis</dd>
			</dl>

		@param {String[]} [opts.dragPrevention=input, textarea, button, select, option, a] Disables dragging from the specified array of element names

			By default dragging will not work when the user clicks in form
			elements, otherwise these elements would be unusable.
			
		@param {Number|Object} [opts.step=1] The pixel interval the draggable snaps to.
			If a number, the draggable will step by that number of pixels on the x and y axis. You
			can provide an object in the form <code>{x:2, y:4}</code> to set different steps to each
			axis.

		@param {Function} [opts.onDrag] An event listener that fires when the draggable starts being dragged.

		@param {Function} [opts.onEnter] An event listener that fires when the draggable is dragged over a drop target.

		@param {Function} [opts.onLeave] An event listener that fires when the draggable is dragged out of a drop target.

		@param {Function} [opts.onDrop] An event listener that fires when the draggable is dropped.
		
		@param {Function} [opts.onAfterDrop] An event listener that fires after the element has dropped, including any animations

			The default action is to animate the draggable back to it's start
			position. This can be cancelled by returning false from the listener
			or calling {@link glow.events.Event.preventDefault} on the
			{@link glow.events.Event} param.
			
		@example
			// create a draggable element with a corresponding DropTarget,
			// container and two event listeners
			var myDraggable = new glow.dragdrop.Draggable('#draggable', {
				dropTargets : [ myDropTarget ],
				container : '#container',
				onDrag : function () {
					this.element.css('opacity', '0.7');
				},
				onDrop : function () {
					this.element.css('opacity', '1');
				}
			});
	*/
	/**
		@name glow.dragdrop.Draggable#event:drag
		@event
		@description Fired when the draggable starts being dragged.

			Concelling this event results in the user being unable to pick up
			the draggable.
		
		@param {glow.events.Event} event Event Object
	*/
	/**
		@name glow.dragdrop.Draggable#event:enter
		@event
		@description Fired when the draggable is dragged over a drop target.
		@param {glow.events.Event} event Event Object
	*/
	/**
		@name glow.dragdrop.Draggable#event:leave
		@event
		@description Fired when the draggable is dragged out of a drop target.
		@param {glow.events.Event} event Event Object
	*/
	/**
		@name glow.dragdrop.Draggable#event:drop
		@event
		@description Fired when the draggable is dropped.
		@param {glow.events.Event} event Event Object
	*/
	/**
		@name glow.dragdrop.Draggable#event:afterDrop
		@event
		@description Fired after the element has dropped, including any animations
		@param {glow.events.Event} event Event Object
	*/
		r.Draggable = function (el, opts) {

			/**
			@name glow.dragdrop.Draggable#element
			@type glow.dom.NodeList
			@description glow.dom.NodeList containing the draggable element
			*/
			this.element = $(el);
			this._opts = opts = glow.lang.apply({
				dragPrevention   : ['input', 'textarea', 'button', 'select', 'option', 'a'],
				placeholder	     : 'spacer',
				placeholderClass : 'glow-dragdrop-placeholder',
				step			 : {x:1, y:1}
			}, opts || {});
			
			//normalise the step param to an object
			if (typeof opts.step == "number") {
				opts.step = {x: opts.step, y: opts.step};
			} else {
				opts.step.x = opts.step.x || 1;
				opts.step.y = opts.step.y || 1;
			}

			this._preventDrag = [];
			for (var i = 0, l = opts.dragPrevention.length; i < l; i++) {
				this._preventDrag[i] = opts.dragPrevention[i].toLowerCase();
			}

			if (opts.container) { this.container = $(opts.container); }
			this._handle = opts.handle && this.element.get(opts.handle) || this.element;

			if (opts.dropTargets) this.dropTargets = $(opts.dropTargets);

				//used for IE literal edge case bug fix
				//this._mouseUp = true;
				//bug fix to get document.body.scrollTop to return true value (not 0) if using transitional 4.01 doctype
				//get('body')[0].style.overflow = 'auto';
				//this._opts = o, this._targetCoords = [], this.isOverTarget = false;

			var listeners = this._listeners = [],
				i = 0;

			if (opts.onDrag)  listeners[i++] = addListener(this, 'drag',  this._opts.onDrag,  this);
			if (opts.onEnter) listeners[i++] = addListener(this, 'enter', this._opts.onEnter, this);
			if (opts.onLeave) listeners[i++] = addListener(this, 'leave', this._opts.onLeave, this);
			if (opts.onDrop)  listeners[i++] = addListener(this, 'drop',  this._opts.onDrop,  this);

			this._dragListener = addListener(this._handle, 'mousedown', this._startDragMouse, this);

			return;
		};


		/*
		Group: Methods
		*/

		//var applyFloatBugfix = glow.env.ie;

		r.Draggable.prototype = {

			/*
			PrivateMethod: _createPlaceholder

			Create an element that occupies the space where the draggable has been dragged from.
			*/

			_createPlaceholder: function () {
				var el = this.element,
					placeholder,
					box = this._box;

				if (this._opts.placeholder == 'clone') {
					placeholder = el.clone();
				}
				else { // placeholder == 'spacer'
					placeholder = placeholderElement(el);
				}
				if (this._opts.placeholderClass) {
					placeholder.addClass(this._opts.placeholderClass);
				}
				box.sizePlaceholder(placeholder, null, this._startLeft, this._startTop);
				el.after(placeholder);
				this._placeholder = placeholder;
			},

			/*
			PrivateMethod: _removePlaceholder

			Removes the placeholder (see above) from the document.
			*/

			_removePlaceholder: function () {
				this._placeholder.remove();
			},

			/*
			PrivateMethod: _resetPosition

			Sets the position CSS property to what it started as without moving the draggable. If the
			original position was 'static' and making it 'static' again would mean moving the draggable,
			then the position is set to 'relative'.
			*/

			_resetPosition: function () {
				var origPos = this._preDragPosition,
					el = this.element,
					box = this._box,
					startOffset = this._startOffset,
					pos = el.css('position'),
					newLeft,
					newTop;
				
				box.resetPosition();
				
				var position = box.el.position(),
					offset = {
						x: position.left,
						y: position.top
					};

				if (this._placeholder || this._dropIndicator) {
					el.remove();
				}
				
				if (origPos == 'static' && offset.y == startOffset.y && offset.x == startOffset.x) {
					el.css('position', 'static');
					el.css('left', '');
					el.css('top', '');
				}
				else {
					el.css('z-index', this._preDragZIndex);
					el.css('position', origPos == 'static' ? 'relative' : origPos);
					if (origPos == 'static') {
						newLeft = offset.x - startOffset.x;
						newTop = offset.y - startOffset.y;
					}
					else if (origPos == 'relative' && pos != 'relative') {
						newLeft = this._startLeft + (offset.x - startOffset.x);
						newTop = this._startTop + (offset.y - startOffset.y);
					}
					if (pos != origPos) {
						el.css('left', newLeft ? newLeft + 'px' : '');
						el.css('top', newTop ? newTop + 'px' : '');
					}
				}
				if (this._dropIndicator) {
					var parent = this._dropIndicator.parent()[0];
					if (parent)	parent.replaceChild(el[0], this._dropIndicator[0]);
					delete this._dropIndicator;
					if (this._placeholder) {
						this._placeholder.remove();
						delete this._placeholder;
					}
					// this is canceling out some of the stuff done in the if statement above, could be done better
					el.css('position', origPos);
					if (origPos == 'relative' && pos != 'relative') {
						el.css('left', this._startLeft);
						el.css('top', this._startTop);
					}
				}
				else if (this._placeholder) {
					var parent = this._placeholder.parent()[0];
					if (parent)	parent.replaceChild(el[0], this._placeholder[0]);
					delete this._placeholder;
				}
			},

			/*
			PrivateFunction: _startDragMouse

			Start the draggable dragging when the mousedown event is fired.

			Arguments:

				*e* (glow.events.Event)

				The mousedown event that caused the listener to be fired.
			*/

			_startDragMouse: function (e) {
				var preventDrag = this._preventDrag,
					source = e.source,
					tag = source.tagName.toLowerCase();

				for (var i = 0, l = preventDrag.length; i < l; i++) {
					if (preventDrag[i] == tag) {
						return;
					}
				}
				
				//fire the drag event
				if (fire(this, 'drag').defaultPrevented()) {
					//the default action was prevented, don't do any dragging
					return;
				}

				if (this._dragging == 1)
					return this.endDrag();
				else if (this._dragging)
					return;

				// _dragging set to 1 during drag, 2 while ending drag and back to 0 when ready for new drag
				this._dragging = 1;

				var el = this.element,
					container = this.container,
					opts = this._opts,
					box = this._box = new Box(el),
					step = opts.step;

				this._preDragPosition = el.css('position');
				
				var position = box.el.position(), 
					startOffset = this._startOffset = {
						x: position.left,
						y: position.top
					};
				
				if (container) {
					this._containerBox = new Box(container);
					this._bounds = this._containerBox.boundsFor(box);
					//we may need to decrease the bounds to keep the element in step (if it's using stepped dragging)
					//basically makes the bounding box smaller to fit in with the stepping
					if (step.x != 1) {
						this._bounds[3] -= (this._bounds[3] - startOffset.x) % step.x;
						this._bounds[1] -= (this._bounds[1] - startOffset.x) % step.x;
					}
					if (step.y != 1) {
						this._bounds[0] -= (this._bounds[0] - startOffset.y) % step.y;
						this._bounds[2] -= (this._bounds[2] - startOffset.y) % step.y;
					}
				}
				else {
					delete this._bounds;
				}

				this._mouseStart = {
					x: e.pageX,
					y: e.pageY
				};

				

				this._preDragStyle = el.attr('style');

				this._preDragZIndex = el.css('z-index');

				el.css('z-index', _zIndex++);

				this._startLeft = el[0].style.left ? parseInt(el[0].style.left) : 0;
				this._startTop = el[0].style.top ? parseInt(el[0].style.top) : 0;


				if (opts.placeholder && opts.placeholder != 'none') {
					this._createPlaceholder();
				}

				el.css('position', 'absolute');
				el.css('left', startOffset.x + 'px');
				el.css('top', startOffset.y + 'px');

				if(_ieStrict) {
					this._scrollY = document.documentElement.scrollTop;
					this._innerHeight = document.documentElement.clientHeight;
				}
				else if(_ieTrans){
					this._scrollY = document.body.scrollTop;
					this._innerHeight = document.body.clientHeight;
				}
				else {
					this._scrollY = window.scrollY;
					this._innerHeight = window.innerHeight;
				}

				var cancelFunc = function () { return false },
					doc = document.documentElement;

				if (this.dropTargets) {
					var event = new events.Event();
					event.draggable = this;
					for (var i = 0, l = this.dropTargets.length; i < l; i++) {
						fire(this.dropTargets[i], 'active', event);
					}

					this._mousePos = {
						x: e.pageX,
						y: e.pageY
					};
					this._testForDropTargets();
				}

				this._dragListeners = [
					addListener(doc, 'selectstart', cancelFunc),
					addListener(doc, 'dragstart',   cancelFunc),
					addListener(doc, 'mousedown',   cancelFunc),
					addListener(doc, 'mousemove',   this._dragMouse, this),
					addListener(doc, 'mouseup',	 this._releaseElement, this)
				];
				return false;
			},

			/*
			PrivateFunction: _dragMouse

			Move the draggable when a mousemove event is received.

			Arguments:

				*e* (glow.events.Event)

				The mousedown event that caused the listener to be fired.
			*/

			_dragMouse: function (e) {
				var element = this.element,
					axis = this._opts.axis,
					//do we need to do axis here, or just not apply the newX/Y if axis is used? May be faster
					newX = axis == 'y' ?
						this._startOffset.x:
						(this._startOffset.x + e.pageX - this._mouseStart.x),
					newY = axis == 'x' ?
						this._startOffset.y:
						(this._startOffset.y + e.pageY - this._mouseStart.y),
					bounds = this._bounds,
					step = this._opts.step;
				
				
				//round position to the nearest step
				if (step.x != 1) {
					newX = Math.round((newX - this._startOffset.x) / step.x) * step.x + this._startOffset.x;
				}
				if (step.y != 1) {
					newY = Math.round((newY - this._startOffset.y) / step.y) * step.y + this._startOffset.y;
				}
				
				// only pay for the function call if we have a container or an axis
				if (bounds) {
					// only apply bounds on the axis we're using
					if (axis != 'y') {
						newX = newX < bounds[3] ? bounds[3] : newX > bounds[1] ? bounds[1] : newX;
					}
					if (axis != 'x') {
						newY = newY < bounds[0] ? bounds[0] : newY > bounds[2] ? bounds[2] : newY;
					}
				}
				
				// set the new position
				element[0].style.left = newX + 'px';
				element[0].style.top = newY + 'px';

				//if there are dragTargets check if the draggable is over the target
				if (this.dropTargets) {
					this._mousePos = { x: e.pageX, y: e.pageY };
				}
				// check for IE mouseup outside of page boundary
				if(_ie && e.nativeEvent.button == 0) {
					this._releaseElement(e);
					return false;
				};
				return false;
			},

			/*
			PrivateFunction: _testForDropTarget

			Check if the draggable is over a drop target. Sets the activeTarget property of the draggable
			to the drop target that the draggable is over, if any.

			Arguments:

				*mousePos* (object)

				The position of the mouse pointer relative to the document. The object has x and y integer
				pixel properties.
			*/
			_testForDropTargets: function (fromTimeout) {

				if (! this._lock) this._lock = 0;
				if (fromTimeout) this._lock--;
				else if (this.lock) return;

				if (this._dragging != 1) return;

				var previousTarget = this.activeTarget,
					activeTarget,
					targets = this.dropTargets,
					target,
					targetBox,
					box = this._box,
					mousePos = this._mousePos;

				box.resetPosition();

				var maxIntersectSize = 0;
				for (var i = 0, l = targets.length; i < l; i++) {
					target = targets[i];
					targetBox = target._box;
					if (target._opts.tolerance == 'contained') {
						if (targetBox.contains(box)) {
							activeTarget = target;
							break;
						}
					}
					else if (target._opts.tolerance == 'cursor') {
						if (targetBox.containsPoint(mousePos)) {
							activeTarget = target;
							break;
						}
					}
					else {
						var intersectSize = targetBox.intersectSize(box, true);
						if (intersectSize > maxIntersectSize) {
							maxIntersectSize = intersectSize;
							activeTarget = target;
						}
					}
				}
				this.activeTarget = activeTarget;

				// enter events
				if (activeTarget !== previousTarget) {
					if (activeTarget) {
						// enter on the target
						var draggableEnterEvent = new events.Event();
						draggableEnterEvent.draggable = this;
						fire(activeTarget, 'enter', draggableEnterEvent);

						// enter on this (the draggable)
						var enterTargetEvent = new events.Event();
						enterTargetEvent.dropTarget = activeTarget;
						fire(this, 'enter', enterTargetEvent);
					}

					if (previousTarget) {
						// leave on target
						var draggableLeaveEvent = new events.Event();
						draggableLeaveEvent.draggable = this;
						fire(previousTarget, 'leave', draggableLeaveEvent);

						// leave on this (draggable)
						var leaveTargetEvent = new events.Event();
						leaveTargetEvent.dropTarget = previousTarget;
						fire(this, 'leave', leaveTargetEvent);
					}
				}
				// place the drop indicator in the drop target (not in the drop target class for speed)
				if (activeTarget && activeTarget._opts.dropIndicator != 'none') {
					var childBox,
						childBoxes = activeTarget._childBoxes,
						children = activeTarget._children;
					box.resetPosition();
					var totalHeight = activeTarget._box.innerTopPos();
					var draggablePosition = mousePos.y - box.offsetParentPageTop();
					var placed = 0;
					for (var i = 0, l = childBoxes.length; i < l; i++) {
						if (children[i] == this.element[0]) continue;
						childBox = childBoxes[i];
						totalHeight += childBox.outerHeight();
						if (draggablePosition <= totalHeight) {
							if (activeTarget._dropIndicatorAt != i) {
								$(childBox.el).before(activeTarget._dropIndicator);
								activeTarget._dropIndicatorAt = i;
							}
							placed = 1;
							break;
						}
					}
					if (! placed) {
						if (childBox) {
							$(childBox.el).after(activeTarget._dropIndicator);
							activeTarget._dropIndicatorAt = i + 1;
						}
						else {
							activeTarget.element.append(activeTarget._dropIndicator);
							activeTarget._dropIndicatorAt = 0;
						}
					}
				}

				this._lock++;
				var this_ = this;
				setTimeout(function () { this_._testForDropTargets(1) }, 100);
			},

			/*
			PrivateMethod: releaseElement

			Finish the drag when a mouseup event is recieved.

			Arguments:

				*e* (glow.events.Event)

				The mouseup event that caused the listener to be fired.
			*/

			_releaseElement: function () {
				if (this._dragging != 1) return;
				this._dragging = 2;

				var i, l;

				//call the onInactive function on all the dropTargets for this draggable
				var dropTargets = this.dropTargets,
					activeTarget = this.activeTarget;

				if (dropTargets) {
					for (i = 0, l = dropTargets.length; i < l; i++) {
						var event = new events.Event();
						event.draggable = this;
						event.droppedOnThis = activeTarget && activeTarget == dropTargets[i];
						fire(dropTargets[i], 'inactive', event);
					}
				}

				if (activeTarget) {
					var event = new events.Event();
					event.draggable = this;
					fire(activeTarget, 'drop', event);
				}

				var dragListeners = this._dragListeners;
				for (i = 0, l = dragListeners.length; i < l; i++) {
					events.removeListener(dragListeners[i]);
				}

				var dropEvent = fire(this, "drop");
				if (! dropEvent.defaultPrevented() && this.dropTargets) {
					this.returnHome();
				}
				else {
					this.endDrag();
				}

			},

			/*
			Method: endDrag

			Finishes dragging the draggable. Removes the placeholder (if any) and resets the position CSS property
			of the draggable.

			TODO - revist this code example

			N.B. This is called by default but if you overwrite the onDrop function then you will have to call it youoriginal
			(code)
			// empty NodeList
			var myDraggable = new glow.dragdrop.Draggable('#draggable', {
				onDrop = function(e){
					do some stuff that takes a while.....
					this.endDrag();
					false;
				}
			});
			(end)
			*/

			endDrag: function(){
				if (this._dragging != 2) return;
				this._dragging = 0;

				//remove any helpers/placeholders
				
				if (this._reset) {
					this._reset();
					delete this._reset;
				}
				
				if (this.placeholder) {
					this.placeholder.remove();
				}
				this._resetPosition();
				delete this.activeTarget;
				fire(this, "afterDrop");
			},

			/*
			Event: returnHome

			Animates the Draggable back to it's start position and calls endDrag() at the end of the
			transition. This is called by default when the Draggable, that has a DragTarget, is dropped.
			However if you override the default onDrop function you may want to call this function your
			original

			Arguments
				tween (function)
				The animation you wish to used for easing the Draggable. See <glow.tweens>. This is optional, the default is a linear tween. e.g. glow.tweens.easeboth
			*/

			returnHome: function(tween){
				var mytween = (tween) ? tween : glow.tweens.linear(),
					leftDestination,
					topDestination,
					el = this.element,
					position = this._box.el.position(),
					distance = Math.pow(
						Math.pow(this._startOffset.x - position.left, 2)
						+ Math.pow(this._startOffset.y - position.top, 2),
						0.5
					),
					duration = 0.3 + (distance / 1000);
				
				var channels = [[
					glow.anim.css(el, duration, {
						left: this._startOffset.x,
						top : this._startOffset.y
					}, { tween: mytween })
				]];

				if (this._dropIndicator) {
					channels.push([glow.anim.css(this._dropIndicator, duration - 0.1, { opacity: { to: 0 } })]);
				}

				var timeline = new glow.anim.Timeline(channels);
				addListener(timeline, 'complete', function () {
					this.endDrag();
				}, this);
				timeline.start();
				return;
			}
		};


		var dropTargetId = 0;

		/**
		@name glow.dragdrop.DropTarget
		@class
		@description An element that can react to Draggables.
		@see <a href="../furtherinfo/dragdrop/droptargets.shtml">DropTarget examples</a>

		@param {String | Element | glow.dom.NodeList} element The element or CSS selector for an element to be made droppable.

			If a {@link glow.dom.NodeList NodeList} or CSS selector matching
			multiple elements is passed only the first element is made droppable.

		@param {Object} [opts]

			An object of options.

			The opts object allows you to pass in functions to use as event
			listeners. This is purely for convenience, you can also use
			{@link glow.events.addListener} to add them the normal way.

		@param {String} [opts.tolerance=intersect] The point at which the target becomes active when a draggable moves over it.

			Possible values for this param are:

			<dl>
			<dt>intersect</dt><dd>The target becomes active as soon as any part of the draggable is over the target.</dd>
			<dt>cursor</dt><dd>The target becomes active when the cursor is over the target.</dd>
			<dt>contained</dt><dd>The target only becomes active once the whole draggable is within the target.</dd>
			</dl>

		@param {String} [opts.dropIndicator=none] Whether to create an element when a Draggable is over the DropTarget.

			Possible values for this param are:

			<dl>
			<dt>spacer</dt><dd>an empty div will be added to the drop target to indicate where the Draggable will be dropped.</dd>
			<dt>none</dt><dd>no drop indicator will be created.</dd>
			</dl>

		@param {String} [opts.dropIndicatorClass=glow-dragdrop-dropindicator] The class apply to the dropIndicator element.

			This is useful if you want to style the drop indicator.

		@param {Function} [opts.onEnter] An event listener to fire when an associated Draggable is dragged over the drop target.

		@param {Function} [opts.onLeave] An event listener to fire when an associated Draggable is dragged out of the drop target.

		@param {Function} [opts.onDrop] An event listener to fire when an associated Draggable is dropped on the drop target.

		@param {Function} [opts.onActive] An event listener to fire when an associated Draggable starts being dragged.

		@param {Function} [opts.onInactive] An event listener to fire when an associated Draggable stops being dragged.
		
		@example
			var myDropTarget = new glow.dragdrop.DropTarget('#dropTarget', {
				onActive: function(e){
						this.element.css('border', '2px solid blue');
				},
				onInactive: function(e){
						this.element.css('border', '');
						this.element.css('opacity', '1');
				},
				onEnter: function(e){
						this.element.css('opacity', '0.2');
				},
				onLeave: function(e){
						this.element.css('opacity', '1');
				},
				onDrop: function(e){
						this.element.css('backgroundColor', 'green');
				}
			});
		*/
		/**
		@name glow.dragdrop.DropTarget#event:active
		@event
		@description Fired when a draggable linked to this drop target starts being dragged.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.dragdrop.DropTarget#event:inactive
		@event
		@description Fired when a draggable linked to this drop target stops dragging.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.dragdrop.DropTarget#event:enter
		@event
		@description Fired when a draggable linked to this drop target is dragged over the target.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.dragdrop.DropTarget#event:leave
		@event
		@description Fired when a draggable linked to this drop target is dragged out of the target.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.dragdrop.DropTarget#event:drop
		@event
		@description Fired when a draggable linked is dropped on this drop target.
		@param {glow.events.Event} event Event Object
		*/
		r.DropTarget = function(el, opts) {
			/**
			@name glow.dragdrop.DropTarget#element
			@type glow.dom.NodeList
			@description glow.dom.NodeList containing the draggable element
			*/
			el = this.element = $(el);
			if (! el.length) throw 'no element passed into DropTarget constuctor';
			if (el.length > 1) throw 'more than one element passed into DropTarget constructor';

			// id is for indexing drop targets in an object for getting to them quickly
			this._id = ++dropTargetId;

			this._opts = opts = glow.lang.apply({
				dropIndicator	   : 'none',
				dropIndicatorClass : 'glow-dragdrop-dropindicator',
				tolerance          : 'intersect'
			}, opts || {});

			if (opts.onActive)   addListener(this, 'active',   opts.onActive);
			if (opts.onInactive) addListener(this, 'inactive', opts.onInactive);
			if (opts.onEnter)	 addListener(this, 'enter',	opts.onEnter);
			if (opts.onLeave)	 addListener(this, 'leave',	opts.onLeave);
			if (opts.onDrop)	 addListener(this, 'drop',	 opts.onDrop);

			addListener(this, 'active', this._onActive);
			addListener(this, 'inactive', this._onInactive);

			return this;
		};


		r.DropTarget.prototype = {

			/*
			Method: setLogicalBottom(height)

			Set a bottom pos to use for detecting if a draggable is over the drop target to use
			other than the actual bottom of the drop target (offsetTop + offsetHeight).

			Arguments:

				*bottom* (integer)

				The number of pixels to use for the bottom of the drop target.
			*/
			setLogicalBottom: function (bottom) {
				this._logicalBottom = bottom;
			},

			/*
			PrivateMethod: _onActive

			Respond to an associated draggable when it starts to be dragged.

			Arguments:

				*e* (glow.events.Event)

				The active event that caused the event listener to be fired.
			*/

			_onActive: function (e) {
				var draggable = e.draggable;

				this._box = new Box(this.element);
				if (this._logicalBottom) this._box.setLogicalBottom(this._logicalBottom);

				if (this._opts.dropIndicator == 'none') return;

				this._onEnterListener = addListener(this, 'enter', this._onEnter);
				this._onLeaveListener = addListener(this, 'leave', this._onLeave);

				this._dropIndicator = placeholderElement(draggable.element);

				if (this._opts.dropIndicatorClass) {
					this._dropIndicator.addClass(this._opts.dropIndicatorClass);
				}
				draggable._box.sizePlaceholder(this._dropIndicator, 'relative', 0, 0);


				var children = this._children = $(this.element.children()).filter(function () {
					var el = $(this);
					return (! e.draggable._placeholder || ! el.eq(e.draggable._placeholder))
						&& (! this._dropIndicator || ! el.eq(this._dropIndicator));
				});
				var childBoxes = this._childBoxes = [];
				children.each(function (i) {
					childBoxes[i] = new Box($(children[i]));
				});
			},

			/*
			PrivateMethod: _onInactive

			Respond to an associated draggable when it finishes being dragged.

			Arguments:

				*e* (glow.events.Event)

				The inactive event that caused the event listener to be fired.
			*/

			_onInactive: function (e) {
				removeListener(this._onEnterListener);
				removeListener(this._onLeaveListener);

				delete this._box;

				if (this._opts.dropIndicator == 'none') return;

				if (! e.droppedOnThis && this._dropIndicator) {
					this._dropIndicator.remove();
					delete this._dropIndicator;
				}
				delete this._childBoxes;
				delete this._children;
			},

			/*
			PrivateMethod: _onEnter

			Respond to an associated draggable being dragged over the drop target.

			Arguments:

				*e* (glow.events.Event)

				The enter event that caused the event listener to be fired.
			*/

			_onEnter: function () {
				this._dropIndicatorAt = -1;
			},

			/*
			PrivateMethod: _onLeave

			Respond to an associated draggable being dragged out of the drop target.

			Arguments:

				*e* (glow.events.Event)

				The leave event that caused the event listener to be fired.
			*/

			_onLeave: function () {
				this._dropIndicator.remove();
			},

			/*
			Method: moveToPosition

			Insert the draggable's element within the drop target where the drop indicator currently is. Sets
			the start offset of the drag to the position of the drop indicator so that it will be animated
			to it's final location, rather than where the drag started.
			*/

			moveToPosition : function (draggable) {
				var dropIndicator = this._dropIndicator,
					box = new Box(dropIndicator);
				//dropIndicator.after(draggable.element);
				var marginLeft = parseInt(dropIndicator.css('margin-left')) || 0,
					marginTop  = parseInt(dropIndicator.css('margin-top')) || 0,
					position = box.el.position();
					
				draggable._startOffset = {
					x: position.left,
					y: position.top
				};
				draggable._dropIndicator = dropIndicator;
				delete this._dropIndicator;
			}

		}
		glow.dragdrop = r;


	}
});
/*@end @*/
