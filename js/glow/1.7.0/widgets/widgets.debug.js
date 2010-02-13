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
/*@cc_on @*/
/*@if (@_jscript_version > 5.5)@*/
/**
 * @name glow.widgets
 * @namespace
 * @description Widget core module.
 * 		The glow.widgets module contains generic functionality used by our
 * 		widgets, but currently no public API.
 */
(window.gloader || glow).module({
	name: "glow.widgets",
	library: ["glow", "1.7.0"],
	depends: [["glow", "1.7.0", 'glow.dom', 'glow.events']],
	builder: function(glow) {
		var doc,
			docBody,
			env = glow.env;
		
		glow.ready(function() {
			doc = document;
			docBody = doc.body;
			
			//check if css or images are disabled, add class name "glow-basic" to body if they aren't
			var testDiv = glow.dom.create('<div class="glow170-cssTest" style="height:0;position:absolute;visibility:hidden;top:-20px;display:block"></div>').appendTo(docBody);
			
			// not testing for height as that break in some browsers' 'zoom' implementations
			if (testDiv.css("visibility") != 'hidden') {
				//css disabled
				docBody.className += " glow170-basic";
			} else {
				// block any further ready calls until our widgets CSS has loaded
				glow._addReadyBlock("glow_widgetsCSS");
				
				(function() {
					if (testDiv.css("z-index") != "1234") {
						//css hasn't loaded yet
						setTimeout( arguments.callee, 10 );
						return;
					}
					// BRING ON THE WALLLLL!
					glow._removeReadyBlock("glow_widgetsCSS");
					
					if (testDiv.css("background-image").indexOf("ctr.png") == -1) {
						docBody.className += " glow170-basic";
					}
				})();
			}
			
			//add some IE class names to the body to help widget styling
			env.ie && (docBody.className += " glow170-ie");
			//note: we apply the class "glow-ielt7" for IE7 if it's in quirks mode
			(env.ie < 7 || !env.standardsMode) && (docBody.className += " glow170-ielt7");
			//some rounding issues in firefox when using opacity, so need to have a workaround
			env.gecko && (docBody.className += " glow170-gecko");
		});
		
		
		glow.widgets = {
			/*
			PrivateMethod: _scrollPos
				Get the scroll position of the document. Candidate for moving into glow.dom?
			*/
			_scrollPos: function() {
				var win = window,
					docElm = env.standardsMode ? doc.documentElement : docBody;
				
				return {
					x: docElm.scrollLeft || win.pageXOffset || 0,
					y: docElm.scrollTop || win.pageYOffset || 0
				};
			}
		};
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.Mask",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.widgets'
	]],
	builder: function(glow) {
		var dom = glow.dom,
			$ = dom.get,
			events = glow.events,
			widgets = glow.widgets,
			bodyProperties, //this is a holding place for body padding & margins
			htmlStr = '<div class="glowNoMask" style="margin:0;padding:0;position:absolute;width:100%;top:0;left:0;overflow:auto;', //reusable html string
			noScrollContainer,
			// javascript:false stops IE complaining over SSL
			iframeSrc = '<iframe class="glowNoMask" src="javascript:false" style="margin:0;padding:0;position:absolute;top:0;left:0;filter:alpha(opacity=0);display:none"></iframe>';
		/**
		@name glow.widgets.Mask
		@class
		@description A semi transparent layer covering the page
		
		Use this if you're wanting to block out the main content of the page.
		Anything you want to be on top of the mask needs to have a higher z-index (default: 9990).
		
		<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
		
		@see <a href="../furtherinfo/widgets/mask/">Mask user guide</a>
		
		@param {Object} opts Object containing the attributes specified below.
		@param {Number} [opts.opacity=0.7] The opacity of the mask (from 0 to 1).
		@param {String} [opts.color=black] The colour of the mask
		@param {Function} [opts.onClick] Shortcut to attach an event listener that is called when the user clicks on the mask.
		@param {Number} [opts.zIndex=9990] The z-index of mask layer
		
		@example
			var mask = new glow.widget.Mask({
				onClick : function () {
					this.remove();
				}
			});
			mask.add();
		
		*/
		
		/*
		Deprecated glow.widgets.Mask() param
		
		@param {Boolean} [opts.disableScroll=false] If set to true, scrolling is disabled in the main document.
		
		This feature is experimental. It works by moving
		the document into a new container, offsetting it and setting overflow
		to none. Because this adds a new element between body and your document,
		you may have problems if your scripts rely on certain elements. Children
		of &lt;body> which have class "glowNoMask" will be left as children of
		&lt;body>.
		
		*/
		
		/**
			@name glow.widgets.Mask#maskElement
			@type glow.dom.NodeList
			@description The node overlayed to create the mask.
			@example
				//create mask instance
				var myMask = new glow.widgets.Mask();
		
				//display mask
				myMask.maskElement.css("background", "url(stripe.png)");
		*/

		function Mask(opts) {
			this.opts = glow.lang.apply({
				color: '#000',
				opacity: 0.7,
				zIndex: 9900,
				disableScroll: false
			}, opts || {});

			/*
			Property: maskElement
				The node overlayed to create the mask. Access this if you want to
				change its properties on the fly
			*/
			var docBody = document.body,
				mask = this.maskElement = dom.create(
				htmlStr + 'z-index:' + this.opts.zIndex + ';background:' + this.opts.color + ';visibility:hidden"></div>'
			).appendTo(docBody),
				that = this;

			mask.css("opacity", this.opts.opacity);

			if (glow.env.ie < 7) {
				this._iframe = dom.create(iframeSrc).css("z-index", this.opts.zIndex - 1).appendTo(docBody);
			}

			//add mask node click event, route it through to a Mask event
			events.addListener(mask, "click", function() {
				events.fire(that, "click");
			});
			if (this.opts.onClick) {
				events.addListener(this, "click", opts.onClick);
			}
		}

		Mask.prototype = {
			/**
			@name glow.widgets.Mask#add
			@function
			@description Displays the mask.
			@example

				// create the mask
				var myMask = new glow.widgets.Mask();

				// add the mask over the screen
				myMask.add()
			*/
			add: function () {
				var doc = $(document),
					body = $(document.body),
					win = $(window),
					that = this;

				if (this.opts.disableScroll && !noScrollContainer) { //avoid blocking scrolling twice
					noScrollContainer = glow.dom.create(
						htmlStr + 'height:100%;overflow:hidden;">' + htmlStr + '"></div></div>'
					);

					var scrollVals = widgets._scrollPos(),
						bodyStyle = body[0].style,
						clientHeight = win.height(),
						clientWidth = win.width(),
						noScroll = noScrollContainer.get("div"),
						//get children which don't have class "glowNoMask"
						bodyChildren = body.children().filter(function() { return (' ' + this.className + ' ').indexOf("glowNoMask") == -1 });

					bodyProperties = {
						margin: [body.css("margin-top"), body.css("margin-right"), body.css("margin-bottom"), body.css("margin-left")],
						padding: [body.css("padding-top"), body.css("padding-right"), body.css("padding-bottom"), body.css("padding-left")],
						height: body.css("height")
					};

					bodyStyle.margin = bodyStyle.padding = 0;

					bodyStyle.height = "100%";
					noScroll[0].style.zIndex = this.opts.zIndex - 1;

					noScrollContainer.appendTo(body);

					noScroll.css("margin", bodyProperties.margin.join(" ")).
							 css("padding", bodyProperties.padding.join(" ")).
							 css("top", -scrollVals.y - parseFloat(bodyProperties.margin[0]) + "px").
							 css("left", -scrollVals.x + "px").
							 append(bodyChildren);
				}

				function resizeMask() {
					
					// hiding the mask in IE6 (and sometimes 7) causes IE to get itself
					// into a resize event loop (keeps firing resize) which freezes the browser.
					// It's ok, hiding the mask for IE didn't update measurements anyway.
					if ( !(glow.env.ie < 8) ) {
						// hide the mask so our measurement doesn't include the mask
						that.maskElement.hide();
					}
					
					// the new height should be the size of the window or the size of the document, whatever's biggest
					var newHeight = that.opts.disableScroll ? noScrollContainer.height() : Math.max( win.height(), doc.height() ),
						newWidth  = that.opts.disableScroll ? noScrollContainer.width()  : Math.max( win.width(),  doc.width() );
						
					// Work out the required width to set the mask (this is basically the width of the content but without the mask)
					that.maskElement.width(newWidth).height(newHeight);
					
					// resize the iframe if we're using it
					if (that._iframe) {
						that._iframe.width(newWidth).height(newHeight);
					}
					
					// show the mask again
					that.maskElement.show();
				}

				this.maskElement.css("visibility", "visible").css("display", "block");
				if (this._iframe) {
					this._iframe.css("display", "block");
				}
				resizeMask();
				this._resizeListener = events.addListener(window, "resize", resizeMask);
			},
			/**
			@name glow.widgets.Mask#remove
			@function
			@description Removes the mask.
			@example

				// create the mask
				var myMask = new glow.widgets.Mask();

				// add the mask over the screen
				myMask.add()

				// remove the mask from over the screen
				myMask.remove()
			*/
			remove : function () {
				this.maskElement.css("visibility", "hidden").css("display", "none");
				if (this._iframe) {
					this._iframe.css("display", "none");
				}
				events.removeListener(this._resizeListener);

				if (this.opts.disableScroll) {
					var body = $(document.body),
						noScroll = noScrollContainer.children();

					noScroll.children().appendTo(body);
					window.scroll(-parseInt(noScroll.css("left")), -parseInt(noScroll.css("top")));
					noScrollContainer.remove();
					body.css("margin", bodyProperties.margin.join(" ")).
						 css("padding", bodyProperties.padding.join(" ")).
						 css("height", bodyProperties.height);

					delete noScrollContainer;
					noScrollContainer = undefined;
				}

			}
		};

		glow.widgets.Mask = Mask;
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.Overlay",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.anim',
		'glow.widgets',
		'glow.widgets.Mask'
	]],
	builder: function(glow) {
		var dom = glow.dom,
			$ = dom.get,
			events = glow.events,
			widgets = glow.widgets,
			env = glow.env,
			anim = glow.anim,
			tweens = glow.tweens,
			/*
			  includes focus hook for the user / other widgets to assign focus to. Tried assigning focus to whole container
			  but that selected all the text in opera 9.5
			*/
			overlayHtml = '<div class="glow170-overlay glowNoMask"><div class="overlay-focalPoint" tabindex="-1"></div></div>',
			overlayCount = 0, //number of overlays on the page, this is used to generate unique IDs
			//this iframe code is duplicated in mask... shall we sort that out?
			// javascript:false stops IE complaining over SSL
			iframeSrc = '<iframe class="glowNoMask" src="javascript:false" style="display:none;margin:0;padding:0;position:absolute;filter:alpha(opacity=0)"></iframe>',
			flashUrlTest = /.swf($|\?)/i,
			wmodeTest = /<param\s+(?:[^>]*(?:name=["'?]\bwmode["'?][\s\/>]|\bvalue=["'?](?:opaque|transparent)["'?][\s\/>])[^>]*){2}/i,
			//fixed positioning isn't supported in IE6 (or quirks mode). Also, Safari 2 does some mental stuff with position:fixed so best to just avoid it
			useFixed = (!env.ie && !(env.webkit < 522)) || (env.ie > 6 && env.standardsMode);

		/**
		 * @name glow.widgets.Overlay.hideElms
		 * @private
		 * @function
		 * @description Hides elements as the overlay shows
		 *
		 * @param {Overlay} overlay
		 */
		function hideElms(overlay) {
			//return if elements have already been hidden, saves time
			if (overlay._hiddenElements[0]) { return; }

			var thingsToHide = new glow.dom.NodeList(),
				hideWhileShown = overlay.opts.hideWhileShown,
				hideFilter = overlay.opts.hideFilter,
				i = 0,
				thingsToHideLen;

			//gather windowed flash
			if (overlay.opts.hideWindowedFlash) {
				thingsToHide.push(
					$("object, embed").filter(function() {
						return isWindowedFlash.call(this, overlay);
					})
				);
			}
			//gather other things to hide
			if (hideWhileShown) {
				thingsToHide.push( $(hideWhileShown) );
			}
			// filter out the elements that are inside the overlay
			thingsToHide = thingsToHide.filter(function() {
				return !$(this).isWithin(overlay.content);
			});
			//get rid of stuff the user doesn't want hidden
			if (hideFilter) { thingsToHide = thingsToHide.filter(hideFilter); }
			
			overlay._hiddenElements = thingsToHide;
			
			for (var i = 0, thingsToHideLen = thingsToHide.length; i < thingsToHideLen; i++) {
				// update how many times this item has been hidden by a glow overlay
				// this lets multiple overlays hide the same element 
				thingsToHide[i].__glowOverlayHideCount = (Number(thingsToHide[i].__glowOverlayHideCount) || 0) + 1;
				
				if (thingsToHide[i].__glowOverlayHideCount == 1) {
					// this is the first attempt to hide the element, so we need to actually hide it
					// also store the current value for visibility
					thingsToHide[i].__glowOverlayInitVis = thingsToHide[i].style.visibility;
					thingsToHide[i].style.visibility = "hidden";
				}
			}
		}

		/**
		 * @name glow.widgets.Overlay.isWindowedFlash
		 * @private
		 * @function
		 * @description Is 'this' a windowed Flash element
		 *   As in, will it show on top of everything. Called from glow.widgets.Overlay.hideElms
		 *   as a filter function
		 *
		 */
		function isWindowedFlash(overlay) {
			var that = this, wmode;
			//we need to use getAttribute here because Opera & Safari don't copy the data to properties
			if (
				(that.getAttribute("type") == "application/x-shockwave-flash" ||
				flashUrlTest.test(that.getAttribute("data") || that.getAttribute("src") || "") ||
				(that.getAttribute("classid") || "").toLowerCase() == "clsid:d27cdb6e-ae6d-11cf-96b8-444553540000")
			) {
				wmode = that.getAttribute("wmode");

				return (that.nodeName == "OBJECT" && !wmodeTest.test(that.innerHTML)) ||
					(that.nodeName != "OBJECT" && wmode != "transparent" && wmode != "opaque");

			}
			return false;
		}

		/**
		 * @name glow.widgets.Overlay.revertHiddenElms
		 * @private
		 * @function
		 * @description Revert items which were hidden when the overlay was shown
		 *
		 */
		function revertHiddenElms(overlay) {
			var hiddenElements = overlay._hiddenElements,
				i = 0,
				len = hiddenElements.length;
			
			for (; i < len; i++) {
				// only show the element again if its hide count reaches zero
				if ( --hiddenElements[i].__glowOverlayHideCount == 0 ) {
					hiddenElements[i].style.visibility = hiddenElements[i].__glowOverlayInitVis;
				}
			}
			overlay._hiddenElements = [];
		}

		/*
		PrivateMethod: generatePresetAnimation
			Generates an animation / timeline object from one of the presets

		Arguments:
			overlay - reference to the overlay
			preset - name of the preset animation
			show - true for 'show' animation. Otherwise 'hide'.
		*/
		function generatePresetAnimation(overlay, show) {
			var channels = [],
				channel = [],
				chanLen = 0,
				chansLen = 0,
				preset = overlay.opts.anim,
				mask = overlay.opts.mask,
				container = overlay.container,
				maskOpacity,
				finalHeight = 0;

			if (preset == "fade") {
				container.css("opacity", (show ? 0 : 1));
				channels[chansLen++] = [
					anim.css(container, 0.3, {
							opacity: {
								from: (show ? 0 : 1),
								to: (show ? 1 : 0)
							}
						}
					)
				];
				if (show) {
					channels[chansLen - 1][1] = function() { container.css("opacity", "") };
				}
				channels[chansLen++] = [generateMaskAnimation(overlay, show)];
			} else if (preset == "roll" || preset == "slide") {
				if (show) {
					container.css("height", "");
					finalHeight = container.height();
					container.css("height", "0");
				}

				channels[chansLen++] = [
					function() {
						/*
							safari doesn't properly recognise switches between 'hidden'
							and 'auto'
						*/
						if (env.webkit < 522 && show) {
							container.css("display", "none");
							setTimeout(function() {
								container.css("overflow", "hidden").css("display", "block");
							}, 0);
						} 
						else {
							container.css("overflow", "hidden");
						}
					},
					anim.css(container, 0.3, {
						height: {to: finalHeight}
					}, {tween: show ? tweens.easeOut() : tweens.easeIn() }),
					function() {
						if (!show) {
							container.css("visibility", "hidden");
						}
						container.css("height", "");
						container.css("overflow", "");
					}
				];
				channels[chansLen++] = [generateMaskAnimation(overlay, show)];
			}
			return new anim.Timeline(channels);
		}

		/*
		PrivateMethod: generateMaskAnimation
			generates an animation for the mask of an overlay to go in a timeline
		*/
		function generateMaskAnimation(overlay, show) {
			if (! overlay.opts.modal) { return 0; }

			var mask = overlay.opts.mask,
				maskOpacity = mask.opts.opacity,
				maskElement = mask.maskElement;

			maskElement.css("opacity", (show ? 0 : maskOpacity));
			return anim.css(maskElement, 0.1, {
					opacity: {
						from: (show ? 0 : maskOpacity),
						to: (show ? maskOpacity : 0)
					}
				}
			)
		}

		/*
		PrivateMethod: closeOverlay
			Hides the overlay. Separated out so this part can happen asyncronously (like after an animation)
		*/
		function closeOverlay(overlay) {
			revertHiddenElms(overlay);
			overlay.container.css("visibility", "").css("display", "");
			if (overlay.opts.modal) {
				overlay.opts.mask.remove();
			} else if (glow.env.ie < 7) {
				overlay._iframe.css("display", "none");
			}
			events.removeListener(overlay._scrollEvt);
			events.removeListener(overlay._resizeEvt);
		}

		/**
		@name glow.widgets.Overlay
		@class
		@description A container element displayed on top of the other page content

		<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
		@see <a href="../furtherinfo/widgets/overlay/">Overlay user guide</a>

		@param {selector|Element|glow.dom.NodeList} content
			the element that contains the contents of the overlay. If this is
			in the document it will be moved to document.body.

		@param {Object} opts
			Zero or more of the following as properties of an object:
			@param {Boolean} [opts.modal="false"] Is the overlay modal?
				If true then a default Mask will be created if one is not provided.
			@param {glow.widgets.Mask} [opts.mask] Mask to use for modal overlays
				used to indicate to the user that the overlay is modal. If provided then the modal property is set to true.
			@param {Boolean} [opts.closeOnMaskClick="true"] if true then listens for a click event on the mask and hides when it fires
			@param {String|Function} [opts.anim="null"] A transition for showing / hiding the panel
				Can be "fade" or "slide", or a function which returns a glow.anim.Animation or glow.anim.Timeline.
				The function is passed the overlay as the first parameter, and 'true' if the overlay is showing, 'false' if it's hiding.
			@param {Number} [opts.zIndex="9991"] The z-index to set on the overlay
				If the overlay is modal, the zIndex of the mask will be set to one less than the value of this attribute.
			@param {Boolean} [opts.autoPosition="true"] Position the overlay relative to the viewport
				If true, the overlay will be positioned to the viewport according to the x & y
				options. If false, you will have to set the position manually by setting the left / top css styles of the
				container property.
			@param {Number|String} [opts.x="50%"] Distance of overlay from the left of the viewport
				If the unit is a percentage	then 0% is aligned to the left of
				the viewport, 100% is aligned to the right of viewport and 50%
				is centered.
			@param {Number|String} [opts.y="50%"] Distance of overlay from the top of the viewport
				If the unit is a percentage	then 0% is aligned to the left of
				the viewport, 100% is aligned to the right of viewport and 50%
				is centered.
			@param {String} [opts.ariaRole] The aria role of the overlay.
				This is used for accessibility purposes. No role is defined by default.
			@param {Object} [opts.ariaProperties] Key-value pairs of aria properties and values
				These are applied to the overlay container for accessibility purposes.
				By default the overlay is a polite live area.
			@param {selector|Element|glow.dom.NodeList} [opts.returnTo] Element to give focus to when the overlay closes
				For accessibility purposes you may want to set an element to give focus to when the overlay closes.
				This meanss devices which present data to the user by the cursor position (such as screen readers)
				will be sent somewhere useful.
			@param {Boolean} [opts.hideWindowedFlash=true] Hide windowed Flash movies?
				When set to true, any Flash movie without wmode "transparent" or "opaque" will be hidden when
				the overlay shows. This is because they always appear on top of other elements on the page. Flash
				movies inside the overlay are excluded from hiding.
			@param {selector|Element|glow.dom.NodeList} [opts.hideWhileShown] Elements to hide while the overlay is shown
				This is useful for hiding page elements which always appear on top of other page elements.
				Flash movies can be handled easier using the hideWindowedFlash option.
			@param {Function} [opts.hideFilter] Exclude elements from hiding
				When provided this function is run for every element that may be hidden. This includes windowed
				Flash movies if 'hideWindowedFlash' is true, and any matches for 'hideWhileShown'. In the function,
				'this' refers to the element. Return false to prevent this element being hidden.
			@param {Boolean} [opts.focusOnShow=false] Give the overlay keyboard focus when it appears?
				Use 'returnTo' to specify where to send focus when the overlay closes
			@param {String} [opts.id] Value for the Overlay container's ID attribute
			@param {String} [opts.className] Values for the Overlay container's class attribute.
			@param {Boolean} [opts.closeOnEsc=false] Close the overlay when the ESC key is pressed
				The overlay needs to have focus for the ESC key to close.

		@example
			var overlay = new glow.widgets.Overlay(
				glow.dom.create(
					'<div>' +
					'  <p>Your Story has been saved.</p>' +
					'</div>'
				)
			);
			overlay.show();
		*/
		/**
			@name glow.widgets.Overlay#event:show
			@event
			@description Fired when the overlay is about to appear on the screen, before any animation.

				At this	point you can access the content of the overlay and make changes 
				before it is shown to the user. If you prevent the default action of this
				event (by returning false or calling event.preventDefault) the overlay 
				will not show.
			
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.Overlay#event:afterShow
			@event
			@description Fired when the overlay is visible to the user and any 'show' animation is complete

				This event is ideal to assign focus to a particular part of	the overlay.
				If you want to change content of the overlay before it appears, see the 
				'show' event.
			
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.Overlay#event:hide
			@event
			@description Fired when the overlay is about to hide

				If you prevent the default action of this event (by returning false or 
				calling event.preventDefault) the overlay will not hide.
			
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.Overlay#event:afterHide
			@event
			@description Fired when the overlay has fully hidden, after any hiding animation has completed
			@param {glow.events.Event} event Event Object
		*/
		function Overlay(content, opts) {
			opts = opts || {};
			//assume modal if mask provided
			if (opts.mask) { opts.modal = true; }

			this.opts = opts = glow.lang.apply({
				modal: false,
				closeOnMaskClick: true,
				zIndex: 9990,
				autoPosition: true,
				x: "50%",
				y: "50%",
				ariaRole: "",
				ariaProperties: {
					live: "polite"
				},
				hideWindowedFlash: true,
				focusOnShow: false,
				id: "glow170Overlay" + (++overlayCount),
				closeOnEsc: false
			}, opts);
			
			// generate a default mask if needed
			if (opts.modal && !opts.mask) {
				opts.mask = new glow.widgets.Mask(opts.zIndex ? {zIndex: opts.zIndex-1} : {});
			}

			/**
			@name glow.widgets.Overlay#content
			@description The content of the overlay
			@type glow.dom.NodeList
			*/
			var contentNode = this.content = $(content),
				that = this,
				/**
				@name glow.widgets.Overlay#container
				@description The overlay's container.
					Use this to alter the width of the overlay. You can also
					manually position the overlay using this node when autoPosition is false.
				@type glow.dom.NodeList
				*/
				overlayNode = this.container = dom.create(overlayHtml).css("z-index", opts.zIndex).attr("aria-hidden", "true"),
				docBody = document.body,
				i;

			/**
			@name glow.widgets.Overlay#_focalPoint
			@private
			@description Dummy element at the start of the overlay to send focus to
			@type glow.dom.NodeList
			*/
			this._focalPoint = overlayNode.get("div.overlay-focalPoint");
			
			/**
			@name glow.widgets.Overlay#_hiddenElements
			@private
			@description Stores elements hidden by this overlay
			@type Node[]
			*/
			this._hiddenElements = [];
			
			/**
			@name glow.widgets.Overlay#_blockScrollRepos
			@private
			@description Don't move the panel along with scrolling
				This is used in setPosition to allow the user to scroll to
				the rest of the content even if autoPosition is on
			@type Object
			*/
			//created on show

			// ensure the overlay has a unique ID, this is used by aria to point at this overlay
			overlayNode[0].id = opts.id;
			
			// add any class names from the user
			overlayNode[0].className += " " + (opts.className || "");

			/**
			@name glow.widgets.Overlay#autoPosition
			@description Position the overlay relative to the viewport
				If true, the overlay will be positioned to the viewport according to the x & y
				options. If false, you will have to set the position manually by setting the left / top css styles of the
				container property.
			@type Boolean
			*/
			this.autoPosition = opts.autoPosition;

			/**
			@name glow.widgets.Overlay#isShown
			@description True if the overlay is showing
			@type Boolean
			*/
			this.isShown = false;

			/**
			 * @name glow.widgets.Overlay#returnTo
			 * @description Element to give focus to when the overlay closes
			 *   For accessibility purposes you may want to set an element to give focus to when the overlay closes.
			 *   This meanss devices which present data to the user by the cursor position (such as screen readers)
			 *   will be sent somewhere useful.
			 * @type selector|Element|glow.dom.NodeList
			 */
			this.returnTo = opts.returnTo;

			//this is used to prevent show / hide commands while animations are underway
			this._blockActions = false;

			//add the content to the page
			overlayNode.append(contentNode).appendTo(docBody);

			//add close event to mask if needed
			if (opts.closeOnMaskClick && opts.mask) {
				events.addListener(opts.mask, "click", function() {
					that.hide();
				});
			}

			//add IE iframe hack if needed
			if (glow.env.ie < 7 && !opts.modal) {
				this._iframe = dom.create(iframeSrc).css("z-index", opts.zIndex - 1).appendTo(docBody);
			}

			//apply aria role
			if (opts.ariaRole) {
				overlayNode.attr("role", opts.ariaRole);
			}

			//apply aria properties
			for (i in opts.ariaProperties) {
				overlayNode.attr("aria-" + i, opts.ariaProperties[i]);
			}

			//closeOnEsc
			if (this.opts.closeOnEsc)
			{
				// If we are going to close the overlay when the user presses the ESC key, we need
				// the overlay to be able to gain focus, so it can capture any events on itself.
				overlayNode.attr("tabIndex", "0");

				// keypress + ESC key not being recognised in webkit, so use keyup instead.
				// However, keyup + Opera doesn't recognise the ESC key, so use keypress as 
				// default for all other browsers.
				// https://bugs.webkit.org/show_bug.cgi?id=25147
				// http://code.google.com/p/chromium/issues/detail?id=9061#c2
				var escKeyEvent = (glow.env.webkit) ? "keyup" : "keypress";

				// When the user presses the ESC key hide the overlay.
				glow.events.addListener(overlayNode, escKeyEvent, function(e){
					if (e.key == "ESC")
					{
						that.hide();
					}
				});
				
			}
		}

		Overlay.prototype = {
			/**
			@name glow.widgets.Overlay#setPosition
			@function
			@description Change or recalculate the position of the overlay
				Call with parameters to
				change the position of the overlay or call without parameters to recalculate
				the position of the overlay. You may need to call this without parameters
				if relative positions become invalid.

			@param {Number|String} [x]
				distance of overlay from the left of the viewport. If the unit is a percentage
				then 0% is aligned to the left of the viewport, 100% is aligned to the right of viewport and 50% is centered.
			@param {Number|String} [y]
				distance of overlay from the top of the viewport. If the unit is a percentage
				then 0% is aligned to the left of the viewport, 100% is aligned to the right of viewport and 50% is centered.

			@returns this
			*/
			setPosition: function(x, y) {
				var container = this.container;
				//don't use set position if autoPosition is false
				if (this.autoPosition) {
					//if values have been provided, set them. Make sure we're not being passed an event object!
					if (x !== undefined && !(x.source)) {
						this.opts.x = x;
						this.opts.y = y;
					}
					var win = $(window),
						x = this.opts.x,
						y = this.opts.y,
						xVal = parseFloat(this.opts.x),
						yVal = parseFloat(this.opts.y),
						blockScrollPos = this._blockScrollRepos,
						useFixedThisTime = useFixed && (!blockScrollPos.x) && (!blockScrollPos.y),
						extraOffset = ((this.opts.mask && this.opts.mask.opts.disableScroll) || useFixedThisTime) ? {x:0,y:0} : widgets._scrollPos(),
						//these are only set if % are involved
						winWidth,
						winHeight,
						containerWidth,
						containerHeight;

					useFixedThisTime && container.css("position", "fixed");

					if (typeof x == "string" && x.indexOf("%") != -1) {
						winWidth = win.width();
						containerWidth = container[0].offsetWidth;

						//what if there's more panel than view?
						if (containerWidth > winWidth) {
							if (!blockScrollPos.x) { //set up the initial position
								container.css("left", widgets._scrollPos().x + "px").css("position", "absolute");
								blockScrollPos.x = true;
							} else if (this.opts.modal && $(document).width() < containerWidth) { //does the mask need to extend further?
								this.opts.mask.maskElement.css("width", containerWidth + "px");
							}
						} 
						else {
							blockScrollPos.x = false;
							container.css("left", Math.max(((winWidth - containerWidth) * (xVal/100)) + extraOffset.x, extraOffset.x) + "px");
						}
					} 
					else {
						container.css("left", xVal + extraOffset.x + "px");
					}

					if (typeof y == "string" && y.indexOf("%") != -1) {
						winHeight = win.height();
						containerHeight = container[0].offsetHeight;

						//what if there's more panel than view?
						if (containerHeight > winHeight) {
							if (!blockScrollPos.y) { //set up the initial position
								container.css("top", widgets._scrollPos().y + "px").css("position", "absolute");
								blockScrollPos.y = true;
							} else if (this.opts.modal && $(document).height() < containerHeight) {
								this.opts.mask.maskElement.css("height", containerHeight + "px");
							}
						} 
						else {
							blockScrollPos.y = false;
							container.css("top", Math.max(((winHeight - containerHeight) * (yVal/100)) + extraOffset.y, extraOffset.y) + "px");
						}
					} 
					else {
						container.css("top", yVal + extraOffset.y + "px");
					}
				}

				if (glow.env.ie < 7 && !this.opts.modal) {
					var overlayStyle = container[0].style;
					this._iframe.css("top", overlayStyle.top).
								 css("left", overlayStyle.left).
								 css("width", container[0].offsetWidth + "px").
								 css("height", container[0].offsetHeight + "px");
				}
				return this;
			},
			/**
			@name glow.widgets.Overlay#show
			@function
			@description Displays the overlay

			@returns this
			*/
			show: function() {
				var that = this,
					showAnim,
					animOpt = that.opts.anim;

				if (that._blockActions || that.isShown) { return that; }

				if (events.fire(that, "show").defaultPrevented()) {
					return that;
				}

				//reset scroll blocking
				this._blockScrollRepos = {x:false, y:false};

				hideElms(that);
				that.container.css("display", "block");
				if (that.opts.modal) {
					that.opts.mask.add();
				} else if (glow.env.ie < 7) {
					that._iframe.css("display", "block");
				}
				that._scrollEvt = events.addListener(window, "scroll", that.setPosition, that);
				that._resizeEvt = events.addListener(window, "resize", that.setPosition, that);

				that.setPosition();

				//run the appropiate animation
				if (typeof animOpt == "string") {
					showAnim = generatePresetAnimation(that, true);
				} else if (typeof animOpt == "function") {
					showAnim = animOpt(that, true);
				} else if (animOpt) {
					showAnim = animOpt.show;
				}
				if (showAnim) {
					if (! showAnim._overlayEvtAttached) {
						events.addListener(showAnim, "complete", function() {
							that._blockActions = false;
							that.isShown = true;
							that.container.attr("aria-hidden", "false");
							events.fire(that, "afterShow");
						});
						showAnim._overlayEvtAttached = true;
					}
					that._blockActions = true;
					showAnim.start();
					that.container.css("visibility", "visible");
				} 
				else {
					that.container.css("visibility", "visible");
					that.isShown = true;
					that.container.attr("aria-hidden", "false");
					events.fire(that, "afterShow");
				}

				//send keyboard focus
				if (that.opts.focusOnShow) {
					that._focalPoint[0].focus();
				}
				
				if (that.opts.modal) { addModalBehaviour.call(that); }
				
				return that;
			},
			/**
			@name glow.widgets.Overlay#hide
			@function
			@description Hides the overlay

			@returns this
			*/
			hide: function() {
				var that = this,
					hideAnim,
					animOpt = that.opts.anim,
					returnTo = that.returnTo ? $(that.returnTo) : new glow.dom.NodeList(),
					returnNodeName;

				if (this._blockActions || !that.isShown) { return that; }
				
				if (events.fire(that, "hide").defaultPrevented()) {
					return that;
				}
				
				if (that.opts.modal) { removeModalBehaviour.call(that); }
				
				//run the appropiate animation
				if (typeof animOpt == "string") {
					hideAnim = generatePresetAnimation(that, false);
				} else if (typeof animOpt == "function") {
					hideAnim = animOpt(that, false);
				} else if (animOpt) {
					hideAnim = animOpt.hide;
				}
				if (hideAnim) {
					if (! hideAnim._overlayEvtAttached) {
						events.addListener(hideAnim, "complete", function() {
							closeOverlay(that);
							that._blockActions = false;
							that.isShown = false;
							events.fire(that, "afterHide");
						});
						hideAnim._overlayEvtAttached = true;
					}
					that._blockActions = true;
					hideAnim.start();
				} 
				else {
					closeOverlay(that);
					that.isShown = false;
					events.fire(that, "afterHide");
				}


				//update aria state
				that.container.attr("aria-hidden", "true");
				//move the focus if applicable
				if (returnTo[0]) {
					returnNodeName = returnTo[0].nodeName;

					//give the element a tab index if it needs one
					if (returnTo[0].tabindex == undefined ||
						returnNodeName != "input" ||
						returnNodeName != "select" ||
						returnNodeName != "textarea" ||
						returnNodeName != "a") {

						returnTo.attr("tabindex", "-1");
					}
					
					returnTo[0].focus();
				}

				// Fix for trac 170 - Overlay: In IE, flash continues to play when overlay is hidden
				// If flash content detected then reinsert the element into its existing position within the DOM.
				// This causes IE to stop the flash movie playing without removing it from the DOM (which would leave us open to JS errors)
				if (glow.env.ie) {
					that.content.get("object").each(function(i) {

						if (
							(this.getAttribute("type") == "application/x-shockwave-flash" ||
							flashUrlTest.test(this.getAttribute("data") || this.getAttribute("src") || "") ||
							(this.getAttribute("classid") || "").toLowerCase() == "clsid:d27cdb6e-ae6d-11cf-96b8-444553540000")
						) {
							this.parentNode.insertBefore(this, this.nextSibling);
						}

					});
				}

				return that;
			}
		};
		
		/** 
			@private
			@description Enforce requirement that focus to stay within the topmost overlay.
			@this {glow.widgets.Overlay}
		 */
		function addModalBehaviour() {
			if (this._keepfocusEventId !== undefined) { return; } // already added this requirement
			
			var overlay = this,   // this overlay
			overlayZindex = null; // the z-index of this overlay
			
			overlayZindex = overlay.container.css('z-index'); // to be closured
			
			this._keepfocusEventId = events.addListener($('body'), 'focus', function(e) {
				var parent = null,   // the parent element of the source element that is a child of the body
				parentZindex = null; // the zindex of that parent
				
				// calculate the zindex of the source elements parent
				parent = e.source.parentNode;				
				while (parent) {
					if (parent.parentNode == document.body) { break; }
					parent = parent.parentNode;
				}
				parentZindex = $(parent).css('z-index');
				
				// when the source element's zindex is less than ours, we take focus back
				if (!parentZindex || parentZindex == "auto" || parentZindex < overlayZindex) {
					overlay._focalPoint && overlay._focalPoint[0].focus();
					return false;
				}
			});
		}
		
		/** 
			@private
			@description Leave environment clean of all changes made by addModalbehaviour().
			@this {glow.widgets.Overlay}
		 */
		function removeModalBehaviour() {
			if (this._keepfocusEventId === undefined) { return; } // already removed this requirement
			events.removeListener(this._keepfocusEventId);
			delete this._keepfocusEventId;
		}
		
		glow.widgets.Overlay = Overlay;
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.Panel",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.widgets.Overlay',
		'glow.i18n'
	]],
	builder: function(glow) {
		var dom = glow.dom,
			$ = dom.get,
			$i18n = glow.i18n,
			events = glow.events,
			widgets = glow.widgets,
			Overlay = widgets.Overlay,
			lang = glow.lang,
			env = glow.env,
			defaultTemplate,
			//a hash of themes, true if their images have been preloaded
			themesPreloaded = {},
			accessAddition = '<div class="panelAccess">{END_LABEL}. <a href="#">{TOP_OF_PANEL_LINK}</a><a href="#">{CLOSE_LINK}</a></div>';

		$i18n.addLocaleModule("GLOW_WIDGETS_PANEL", "en", {
			END_LABEL : "End of panel",
			CLOSE_LINK : "Close Panel",
			TOP_OF_PANEL_LINK : "Back to top of panel"
		});
	

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
		 This block outputs CSS rules for IE only directly to the page.
		 It is here so that the path to the PNGs can be deduced from the location of the widgets
		 css file.
		 It is acceptable because this design will not be altered before version 2 of glow, and
		 at that point it will be modified to avoid the use of PNGs.
		 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

		if(glow.env.ie) {
			glow.ready(function () {
				var widgetSheet = function (sheets) {
						var i=0,
						len = sheets.length,
						sheet;
						for (; i < len; i++) {
							if (sheets[i].href.indexOf("widgets/widgets") != -1) {
								return sheets[i];
							}
							else {
								if (sheets[i].imports.length && (sheet = arguments.callee(sheets[i].imports))) {
									return sheet;
								}
							}
						}
						return false;
					}(document.styleSheets),

					_ieCssRule = function(theme, className, image) {
						return ".glow170-ie .glow170-overlay" + cssPngThemes[theme].className + " ." +
								className + " {background:none;filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src='" +
								iePngRoot + "/images/" + cssPngThemes[theme].path + "/" + image + ".png', sizingMethod='crop');}";
					},

					cssPngThemes = {
						light : {
							className : " .panel-light",
							path : "lightpanel"
						},
						dark : {
							className : "",
							path : "darkpanel"
						}
					},

					iePngRoot = widgetSheet.href.substring(0, widgetSheet.href.lastIndexOf("/")),

					styleBlock = "<style type='text/css'>";

				for(var thm in cssPngThemes) {
					styleBlock = styleBlock
					+ _ieCssRule(thm, "tr", "ctr")
					+ _ieCssRule(thm, "tl", "ctl")
					+ _ieCssRule(thm, "bl", "cbl")
					+ _ieCssRule(thm, "br", "cbr")
					+ _ieCssRule(thm, "infoPanel-pointerT", "at")
					+ _ieCssRule(thm, "infoPanel-pointerR", "ar")
					+ _ieCssRule(thm, "infoPanel-pointerB", "ab")
					+ _ieCssRule(thm, "infoPanel-pointerL", "al");
				}

				styleBlock = styleBlock + "</style>";

				glow.dom.get("head").append(glow.dom.create(styleBlock));
			});
		}

		/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

		/*
		PrivateMethod: generateDivString
			generates <div class="{arg}"></div> for 2nd arg onwards if first arg is false.
			generates <div class="{arg}"><div></div></div> for 2nd arg onwards if first arg is true.
		*/
		function generateDivString(nest) {
			var insideDiv = nest ? '<div></div>' : '';
			for (var i = 1, len = arguments.length, r = []; i < len; i++) {
				r[i-1] = '<div class="' + arguments[i] + '">' + insideDiv + '</div>';
			}
			return r.join("");
		}

		/*
		PrivateMethod: closeClick
			Run when one of the panel's close buttons are clicked
		*/
		function closeClick() {
			this.hide();
			return false;
		}

		/*
		PrivateProperty: defaultTemplate
			default template for a panel & infoPanel
		*/
		defaultTemplate = function() {
			var r = [], rLen = 0;
			r[rLen++] = '<div class="glow170-panel">';
				r[rLen++] = '<div class="defaultSkin">';
					r[rLen++] = generateDivString(false, "infoPanel-pointerT", "infoPanel-pointerL", "infoPanel-pointerR");
					r[rLen++] = '<div class="pc">';
						r[rLen++] = generateDivString(false, "tr", "tl");
						r[rLen++] = generateDivString(true, "tb");
						r[rLen++] = '<div class="tc">';
							r[rLen++] = generateDivString(false, "bars");
							r[rLen++] = '<div class="c">';
								r[rLen++] = '<a class="panel-close" href="#" title="close">X</a>';
								r[rLen++] = generateDivString(false, "panel-hd", "panel-bd", "panel-ft");
							r[rLen++] = '</div>';
						r[rLen++] = '</div>';
						r[rLen++] = generateDivString(false, "br", "bl");
						r[rLen++] = generateDivString(true, "bb");
					r[rLen++] = '</div>';
					r[rLen++] = generateDivString(false, "infoPanel-pointerB");
				r[rLen++] = '</div>';
			r[rLen++] = '</div>';
			return r.join("");
		}();
		
		/**
		@name glow.widgets.Panel
		@class
		@description An overlay with default themes and addtional functionality.
			Includes templating system.
		@augments glow.widgets.Overlay
		@see <a href="../furtherinfo/widgets/panel/">Panel user guide</a>

		@param {selector|Element|glow.dom.NodeList} content
			the element that contains the contents of the Panel. If this is
			in the document it will be moved to document.body. If your content node has a child element with class "hd"
			it will be added to the header of the panel. Similarly, an element with class "ft" will be added to the
			footer of the panel.

		@param {Object} opts
			Zero or more of the following as properties of an object:
			@param {Number|String} [opts.width=400] Width of the panel
				Default of 400px gives a content width of 360px in the default template
			@param {String} [opts.theme="dark"] Visual theme
				Only applies when using the default template. Currently supported themes are "dark" and "light".
			@param {String} [opts.template] An html template to use to create the panel
			@param {Boolean} [opts.modal=true] is the overlay modal?
				If true then a default Mask will be created if one is not provided.
			@param {String} [opts.ariaRole="dialog"] The aria role of the panel.
				This is used for accessibility purposes,
				the default is acceptable for panels which interupt the user and should
				be dealt with before interacting with the rest of the page.
			@param {Boolean} [opts.focusOnShow=true] Give the overlay keyboard focus when it appears?
				Use 'returnTo' to specify where to send focus when the overlay closes

		*/
		function Panel(content, opts) {
			content = $(content);
			opts = opts || {};

			if (typeof opts.width == "number") {
				opts.width += 'px';
			}

			if (opts.template) {
				var customTemplate = true;
			}

			//option defaults
			opts = glow.lang.apply({
				template: defaultTemplate,
				width: "400px",
				modal: true,
				theme: "dark",
				ariaRole: "dialog",
				focusOnShow: true
			}, opts);

			//dress content in template
			var fullContent = dom.create(opts.template),
				headContent = content.get("> .hd"),
				footerContent = content.get("> .ft"),
				docBody = document.body,
				that = this,
				fullContentClone,
				i,
				localePanelModule = glow.i18n.getLocaleModule("GLOW_WIDGETS_PANEL"),
				accessLinks = dom.create(accessAddition, {interpolate: setAccessibilityFooter(localePanelModule)});

			/**
			* @name setAccessibilityFooter
			* @private
			* @function
			* @description If the param opts.accessbilityFooter is set then override the i18n label with the contents of the param
			*
			* @param {glow.i18n.getLocaleModule} localePanelModule
			*/
			function setAccessibilityFooter(localePanelModule) {
				if (typeof opts.accessibilityFooter == "string") {
					localePanelModule["END_LABEL"] = opts.accessibilityFooter;
				}
				return localePanelModule;
			}

			if (!customTemplate) {
				fullContent.addClass("panel-" + opts.theme);
				//preload the images of the theme
				if (!themesPreloaded[opts.theme] && docBody.className.indexOf("glow170-basic") == -1) {
					fullContentClone = fullContent.clone().addClass("glow170-panel-preload").appendTo(docBody);
					themesPreloaded[opts.theme] = true;
				}
			}


			/*
				if we've been passed more than one node it's possible the user
				has ommited the container (usually if they're creating the panel
				from a string), let's be kind and deal with that.
			*/
			if (content.length > 1) {
				content.each(function() {
					var elm = $(this);
					if (elm.hasClass("hd")) {
						headContent = elm;
					} else if (elm.hasClass("ft")) {
						footerContent = elm;
					}
				});
			}

			/**
			@name glow.widgets.Panel#header
			@description The panel's header element
			@type glow.dom.NodeList
			*/
			this.header = fullContent.get(".panel-hd");
			/**
			@name glow.widgets.Panel#footer
			@description The panel's footer element
			@type glow.dom.NodeList
			*/
			this.footer = fullContent.get(".panel-ft");
			/**
			@name glow.widgets.Panel#body
			@description The panel's body element
			@type glow.dom.NodeList
			*/
			this.body = fullContent.get(".panel-bd");

			if (content.isWithin(docBody)) {
				fullContent.insertBefore(content);
			} else {
				fullContent.appendTo(docBody);
			}
			this.body.append(content);
			if (headContent.length) {
				this.header.append(headContent);
			} else if (!customTemplate) {
				fullContent.addClass("panel-noHeader");
			}
			if (footerContent.length) { this.footer.append(footerContent); }

			//add listeners for close buttons
			events.addListener(fullContent.get(".panel-close"), "click", closeClick, this);
			events.addListener(accessLinks.get("a").item(1), "click", closeClick, this);

			// accessibility link: give screen reader link to go back to the top of the panel
			events.addListener(accessLinks.get("a").item(0), "click", function() {
				$('.overlay-focalPoint')[0].focus();
			}, this);

			Overlay.call(this, fullContent, opts);

			//apply width
			this.container.css("width", opts.width).
				//add close button to end for accessability
				append(accessLinks);

		}
		lang.extend(Panel, Overlay);

		glow.widgets.Panel = Panel;
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.Sortable",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.dragdrop',
		'glow.widgets'
	]],
	builder: function(glow) {

		var $ = glow.dom.get,
			events = glow.events,
			fire = events.fire,
			addListener = events.addListener;

		/**
		@name glow.widgets.Sortable
		@constructor
		@description Reorder page elements using drag and drop
		@see <a href="../furtherinfo/widgets/sortable/">Sortable user guide</a>

		@param {glow.dom.NodeList | String | HTMLElement[]} containers The container or containers of the items to be made sortable.
		@param {Object} [opts] A set of named options (see below).
		@param {glow.dom.NodeList | String} [opts.constrainDragTo] Limit the dragging to within a specific element
		@param {String} [opts.axis] Restrict dragging to a particular axis
		@param {String} [opts.dropIndicatorClass=glow-sortable-dropindicator] The name of the class to apply to the element that indicates where an item will be dropped.
		@param {Boolean} [opts.equaliseColumns=true] Make the bottom of each container the same.
		@param {Object} [opts.draggableOptions] An options object to apply to each draggable.
			See {@link glow.dragdrop.Draggable Draggable} for options
		@param {Function} [opts.onSort] Create an event listener that is fired when the sortable is sorted - i.e. after one of the draggables has been dragged.
		
		*/

		/**
		@name glow.widgets.Sortable#event:sort
		@event
		@description Fired when an item in the sortable has been dragged.
		@param {glow.events.Event} event Event Object
		*/

		/**
		@name glow.widgets.Sortable#containers
		@type glow.dom.NodeList
		@description The elements that contain the sortable items.
		@example

			var mySortable = new glow.widgets.Sortable('div#sections');
			alert(mySortable.containers); // Returns a nodeList of all the sortable items
		
		*/

		/**
		@name glow.widgets.Sortable#draggables
		@type glow.dragdrop.Draggables[]
		@description Array of draggables that can be sorted. Read-only.
		@example

			var mySortable = new glow.widgets.Sortable('div#sections');
			alert(mySortable.draggables); // Returns glow.dragdrop.Draggables[]

		*/

		/**
		@name glow.widgets.Sortable#dropTargets
		@type glow.dragdrop.DropTargets[]
		@description Array of drop targets that draggable can be dragged to and sorted within. Read-only.
		@example

			var mySortable = new glow.widgets.Sortable('div#sections');
			alert(mySortable.dropTargets); // Returns glow.dragdrop.DropTargets[]
		*/

		var Sortable = function (containers, opts) {
			this._opts = opts = glow.lang.apply({
				dropIndicatorClass : 'glow-sortable-dropindicator',
				equaliseColumns    : true,
				draggableOptions   : {}
			}, opts || {});

			this.constrainDragTo = opts.constrainDragTo;
			this.axis = opts.axis;
			this.draggables = [];

			var containers = this.containers = $(containers),
				dropTargets = this.dropTargets = [];

			if (opts.onSort) {
				addListener(this, "sort", opts.onSort);
			}

		    // drop targets
			containers.each(function (i) {
				dropTargets[i] = new glow.dragdrop.DropTarget(this, {
					tolerance          : 'intersect',
					dropIndicator      : 'spacer',
					dropIndicatorClass : opts.dropIndicatorClass
				});
			});

			// draggables
			this.addItems( containers.children() );
		};
			
			
		/**
		@private
		@name glow.widgets.Sortable#handleDrag
		@function
		@description Called when a drag operation is started. Can return false to prevent dragging
		*/
		function handleDrag() {
			// if items are still in motion, prevent dragging
			if (this._itemsInMotion) {
				return false;
			}
			if (this._opts.equaliseColumns) {
				equaliseColumns.call(this);
			}
			// stuff is in the air now...
			this._itemsInMotion = true;
		}
		
		/**
		@private
		@name glow.widgets.Sortable#equaliseColumns
		@function
		@description Sets the logical bottom of each drop target to the same
		position on the page.

		This allows sortable items to be dragged sideways into a column that
		does not extend as far as the column that the item is being dragged from.

		*/

		function equaliseColumns () {
		    var offsets = [], maxBottom = 0, bottom, dropTargets = this.dropTargets;
			this.containers.each(function (i) {
				var el = $(this);
				offsets[i] = el.position().top;
				bottom = offsets[i] + el[0].offsetHeight;
				if (glow.env.khtml) bottom -= el.css('margin-top') + el.css('margin-bottom');
				if (bottom > maxBottom) maxBottom = bottom;
			});
			for (var i = 0, l = this.dropTargets.length; i < l; i++)
				this.dropTargets[i].setLogicalBottom(maxBottom);
		}

		/**
		@private
		@name glow.widgets.Sortable#handleDrop
		@function
		@description Event handler that handles a draggable being dropped.
		*/

		function handleDrop (e) {
			var draggable = e.attachedTo,
				el = draggable.element,
				target = draggable.activeTarget;
				
		    this._previous = el.prev();
			this._parent = el.parent();
			if (target)	target.moveToPosition(draggable);
	    }

		/**
		@private
		@name glow.widgets.Sortable#handleAfterDrop
		@function
		@description Event handler that is called after a droppable is dropped.

		Fires the sort event.

		*/

		function handleAfterDrop (e) {
			var draggable = e.attachedTo,
				el = draggable.element;
			if (! el.prev().eq(this._previous || []) || ! el.parent().eq(this._parent)) {
				fire(this, "sort");
			}
			// we're done moving
			this._itemsInMotion = false;
			delete this._previous;
			delete this._parent;
	    }

		/*
		Group: Functions
		*/

		Sortable.prototype = {
			/**
			@name glow.widgets.Sortable#addItems
			@function
			@description Add items to the sortable.

			Should not contain items that are were a child of one of the containers when the sortable was created.

			@param {glow.dom.NodeList | String | Element[]} elements The elements to be added to the sortable.
			*/


			addItems : function (elements) {
				var this_ = this, opts = this._opts.draggableOptions;
				$(elements).each(function () {
					var draggable = new glow.dragdrop.Draggable(this,
						glow.lang.apply({
							placeholder       : 'none',
							axis              : this_.axis,
							container         : this_.constrainDragTo,
							dropTargets       : this_.dropTargets
						}, opts)
					);

					
					addListener(draggable, 'drag', handleDrag, this_);
					addListener(draggable, 'drop', handleDrop, this_);
					addListener(draggable, 'afterDrop', handleAfterDrop, this_);

					this_.draggables.push(draggable);
				});
			}

		};

		glow.widgets.Sortable = Sortable;
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.InfoPanel",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.widgets.Panel'
	]],
	builder: function(glow) {
		var dom = glow.dom,
			$ = dom.get,
			events = glow.events,
			widgets = glow.widgets,
			lang = glow.lang,
			env = glow.env,
			win,
			positionRegex = /glow170\-infoPanel\-point[TRBL]/,
			offsetInContextDefaults = {
				T: {x:"50%", y:"100%"},
				R: {x:0, y:"50%"},
				B: {x:"50%", y:0},
				L: {x:"100%", y:"50%"}
			};

		glow.ready(function() {
			win = $(window);
		});

		/*
		PrivateMethod: resolveRelative
			will work out x & y pixel values for percentage values within a context element.
			Non percentage values will just be passed back
		*/
		function resolveRelative(point, context) {
			var vals = [point.x, point.y],
				axis = ["x", "y"],
				sides = ["Width", "Height"],
				i = 0;

			//calculate for x & y
			for (; i < 2; i++) {
				if (vals[i].slice) {
					vals[i] = parseFloat(point[axis[i]]);
					if (point[axis[i]].slice(-1) == "%") {
						vals[i] = context[0]["offset" + sides[i]] * (vals[i]/100);
					}
				}
			}
			return {x: vals[0], y: vals[1]};
		}

		/*
		PrivateMethod: calculateBestPointerSide
			works out which side the pointer should appear on
		*/
		function calculateBestPointerSide(contextPos, contextSize) {
			//right, we need to work out where to put the box ourselves
			var scrollPos = widgets._scrollPos(),
				winSize = {x: win.width(), y:win.height()},
				//let's see how much free space there is around the context
				freeSpace = {
					T: winSize.y - contextPos.top - contextSize.y + scrollPos.y,
					R: contextPos.left - scrollPos.x,
					B: contextPos.top - scrollPos.y,
					L: winSize.x - contextPos.left - contextSize.x + scrollPos.x
				},
				preferenceOrder = ["T", "R", "B", "L"];

			preferenceOrder.sort(function(a, b) {
				return freeSpace[b] - freeSpace[a];
			});

			//could this be made clevererer? (which is why I did the preferenceOrder thing, the first may not always be best)
			return preferenceOrder[0];
		}
		/**
		@name glow.widgets.InfoPanel
		@class
		@description A panel with content directed at a particular point on the page.
		@augments glow.widgets.Panel
		@see <a href="../furtherinfo/widgets/infopanel/">InfoPanel user guide</a>

		@param {selector|Element|glow.dom.NodeList} content
			the element that contains the contents of the Panel. If this is
			in the document it will be moved to document.body. If your content node has a child element with class "hd"
			it will be added to the header of the panel. Similarly, an element with class "ft" will be added to the
			footer of the panel.

		@param {Object} opts
			Zero or more of the following as properties of an object:
			@param {String|Element|glow.dom.NodeList} [opts.context] Element to point at.
				If no context is provided then the panel must be positioned manually using
				the container property.
			@param {String} [opts.pointerPosition] Restrict the point to a particular side.
				The default is dependant on the context's position on the page.
				The panel will try to be where it is most visible to the user. To restrict the position,
				set this property to "t"/"r"/"b"/"l"; top / left / bottom / right respectively.
			@param {String} [opts.theme="light"] Visual theme
				Only applies when using the default template. Currently supported themes are "dark" and "light".
			@param {Object} [opts.offsetInContext] Position of the pointer within the context.
				In the format {x: 24, y: "50%"}. The default points to an edge of
				the context, depending on the position of the pointer.
			@param {Object} [opts.pointerRegisters] Identify the position of the point within pointer elements.
				Only required for custom templates.
			@param {Boolean} [opts.modal=false] is the overlay modal?
				If true then a default Mask will be created if one is not provided.
			@param {String} [opts.ariaRole="tooltip"] The aria role of the panel.
				This is used for accessibility purposes,
				the default is acceptable for panels which provide descriptive
				content for a page element
			@param {selector|Element|glow.dom.NodeList} [opts.returnTo] Element to give focus to when the overlay closes
				By default, this is the context element if focusOnShow is true.
				
				For accessibility purposes you may want to set an element to give focus to when the overlay closes.
				This means devices which present data to the user by the cursor position (such as screen readers)
				will be sent somewhere useful.
		*/
		function InfoPanel(content, opts) {
			opts = opts || {};

			if (opts.template) {
				var customTemplate = true;
			}

			opts = glow.lang.apply({
				modal: false,
				theme: "light",
				autoPosition: !!opts.context,
				pointerRegisters: {
					t: {x: "50%", y: 0},
					r: {x: "100%", y: "50%"},
					b: {x: "50%", y: "100%"},
					l: {x: 0, y: "50%"}
				},
				ariaRole: "tooltip",
				focusOnShow: true
				// the default for opts.returnTo is set below
			}, opts);
			
			if (opts.focusOnShow && opts.returnTo === undefined) {
				opts.returnTo = opts.context;
			}

			//deal with context if it's a selector
			opts.context = opts.context && $(opts.context);

			widgets.Panel.call(this, content, opts);

			//add describedby aria bit
			opts.context && opts.context.attr("aria-describedby", this.container[0].id);

			if (!customTemplate) {
				this.content.addClass("glow170-infoPanel");
			}

			this.content.addClass("glow170-infoPanel-point" + (opts.pointerPosition || "t").slice(0,1).toUpperCase());
		}
		lang.extend(InfoPanel, widgets.Panel);

		lang.apply(InfoPanel.prototype, {
			/**
			@name glow.widgets.InfoPanel#setPosition
			@function
			@description Change or recalculate the position of the InfoPanel
				Call with parameters to
				change the position of the InfoPanel or call without parameters to simply
				reposition. You may need to call this without parameters if the element
				the Panel is pointing at changes position.

			@param {Number|String} [x]
				Pixel distance from the left of the document to point at.
			@param {Number|String} [y]
				Pixel distance from the top of the document to point at.

			@returns this
			*/
			setPosition: function(x, y) {
				//don't use set position if autoPosition is false
				var valsPassed = (x !== undefined && !(x.source)),
					// a quick and dirty way to find out if the element is visible
					isCurrentlyHidden = !this.container[0].offsetHeight;

				if (!(this.autoPosition || valsPassed)) {
					return this;
				} else if (valsPassed) {
					this.autoPosition = false;
				}

				if ( isCurrentlyHidden ) {
					// Remove display:none; so container will render and
					// we can find offSets
					this.container.css("display","block");
				}

				var opts = this.opts,
					contentNode = this.content[0],
					pointerPosition = (opts.pointerPosition || "").slice(0,1),
					context = opts.context,
					container = this.container,
					//here's what we need to position the pointer
					pointerElm,
					//this will hold the point the user passed, or the context's offset
					contextOffset = valsPassed ? {left:x, top:y} : context.offset(),
					contextSize = valsPassed ? {x:0, y:0} : {x:context[0].offsetWidth, y:context[0].offsetHeight},
					offsetInContext,
					pointOffsetInPanel,
					pointerInnerOffset,
					panelOffset = container.offset(),
					pointerOffset,
					lastPointerPosition;

				if (!pointerPosition) {
					//right, we need to work out where to put the box ourselves
					pointerPosition = calculateBestPointerSide(contextOffset, contextSize);
					if (lastPointerPosition != pointerPosition) {
						lastPointerPosition = pointerPosition;
						contentNode.className = contentNode.className.replace(positionRegex, "glow170-infoPanel-point" + pointerPosition);
						pointerElm = container.get(".infoPanel-pointer" + pointerPosition);
					}
				} else {
					pointerPosition = pointerPosition.toUpperCase();
				}

				if (!pointerElm) {
					pointerElm = container.get(".infoPanel-pointer" + pointerPosition);
				}

				//get default offset if there isn't one
				offsetInContext = valsPassed ? {x:0, y:0} : resolveRelative(opts.offsetInContext || offsetInContextDefaults[pointerPosition], context);
				pointerInnerOffset = resolveRelative(opts.pointerRegisters[pointerPosition.toLowerCase()], pointerElm);
				pointerOffset = pointerElm.offset();
				pointOffsetInPanel = {left: pointerOffset.left - panelOffset.left + pointerInnerOffset.x, top: pointerOffset.top - panelOffset.top + pointerInnerOffset.y};

				if ( isCurrentlyHidden )	{
					// Leave things as we found them
					this.container.css("display","none");
				}

				container.css("left", contextOffset.left + offsetInContext.x - pointOffsetInPanel.left + "px").
						  css("top", contextOffset.top + offsetInContext.y - pointOffsetInPanel.top + "px");

				if (env.ie < 7 && !opts.modal) {
					var overlayStyle = container[0].style;
					this._iframe.css("top", overlayStyle.top).
								 css("left", overlayStyle.left).
								 css("width", container[0].offsetWidth + "px").
								 css("height", container[0].offsetHeight + "px");
				}
				return this;
			},
			/**
			@name glow.widgets.InfoPanel#setContext
			@function
			@description Change element to point at.
				If no context is provided then the panel must be positioned manually using
				the container property.

			@param {String|HTMLElement|glow.dom.NodeList} context
				Element to point at

			@returns this
			*/
			setContext: function(context) {
				var currentContext = this.opts.context;
				if (currentContext) {
					//remove aria from current context
					currentContext.removeAttr("aria-describedby");
					//change the returnTo value if it's currently refering to the context
	
					if ($(this.returnTo)[0] == currentContext[0]) {
						this.returnTo = context;
					}
				}
				
				//add aria to new context
				this.opts.context = $(context).attr("aria-describedby", this.container[0].id);
				if (!this.returnTo) {
					this.returnTo = this.opts.context;
				}
				this.autoPosition = true;
				if (this.container[0].style.display == "block") {
					this.setPosition();
				}
				return this;
			}
		});

		glow.widgets.InfoPanel = InfoPanel;
	}
});
(window.gloader || glow).module({
	// add the name of your new module
	name: "glow.widgets.Slider",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		// add the names of modules this modules depends on here, eg:
		"glow.dom",
		"glow.events",
		"glow.dragdrop",
		"glow.anim",
		"glow.widgets"
	]],
	builder: function(glow) {
		
		// private vars
		var $ = glow.dom.get,
			events = glow.events,
			env = glow.env,
			// private reference to Ruler class
			Ruler,
			// private reference to the slider class
			Slider,
			// array of event names, used to apply event handlers passed in through opts
			eventNames = ["slideStart", "slideStop", "change"],
			// this holds the name of the last key to be pressed.
			// Keep this, because we only want to react to the keyup for the very last keydown
			// Also, if this is null we know there aren't any keys currently pressed
			lastKeyDown = null,
			//interval id for repeating nudges on buttons
			nudgeButtonRepeater,
			//interval id for repeating keyboard nav
			keyRepeater,
			//the os sliced to 3 chars
			os = navigator.platform.slice(0, 3),
			// this will store terms used which differ if the slider is horizontal or vertical
			vocabs = [
				{
					containerClassNamePart: "slider",
					length: "width",
					lengthUpper: "Width", 
					pos: "left",
					trackToChange: "_trackOnElm",
					axis: "x",
					pagePos: "pageX"
				},
				{
					containerClassNamePart: "vSlider",
					length: "height",
					lengthUpper: "Height", 
					pos: "top",
					trackToChange: "_trackOffElm",
					axis: "y",
					pagePos: "pageY"
				}
			],
			/*
			 HTML for the slider 
			 This still needs to be wrapped in <div class="glow170-slider"> or
			 <div class="glow170-vSlider"> before it's created
			*/
			SLIDER_TEMPLATE = '' +
				'<div class="slider-theme">'+
					'<div class="slider-state">'+
						'<div class="slider-container">'+
							'<div class="slider-btn-bk"></div>'+
							'<div class="slider-track">'+
								'<div class="slider-trackOn"></div>'+
								'<div class="slider-trackOff"></div>'+
								'<div class="slider-handle"></div>'+
							'</div>'+
							'<div class="slider-labels"></div>'+
							'<div class="slider-btn-fwd"></div>'+
						'</div>'+
					'</div>'+
				'</div>';
		
		
		/*
			Returns the lowest common divisor for all the arguments. Ignores any
			zero params.
		*/
		function greatestCommonDivisor(/* numbers */) {
			var i = 0,
				len = arguments.length,
				r,
				b;
				
			// get first non-zero param
			while ( !(r = arguments[i++]) && (i < len) );
			
			for (; i < len; i++) {
				b = arguments[i];
				// ignore zeros
				if (!b) { continue; }
				
				while (1) {
					r = r % b;
					if (!r) {
						r = b;
						break;
					}
					b = b % r;
					if (!b) {
						break;
					}
				}
			}
			return r;
		}
				
		// closure for Ruler
		(function() {
			var vocabs = [
				{
					containerClassNamePart: "ruler",
					length: "width",
					pos: "left"
				},
				{
					containerClassNamePart: "vRuler",
					length: "height",
					pos: "top"
				}
			];
			
			
			
			/*
			  container - where to insert the ruler
			  opts.min - start val
			  opts.max - end val
			  opts.tickMajor - interval for major ticks
			  opts.tickMinor - interval for minor ticks
			  opts.labels - as with slider
			  opts.labelMapper - function which takes a label string and returns a new string. For adding stuff like % to the end
			  opts.vertical - vertical ruler
			  opts.reverse - makes the right / bottom of the ruler the start
			  opts.id - id on element
			  opts.className - additional class names for element
			*/
			Ruler = function(container, opts) {
				container = $(container);
				
				// assign default options
				opts = glow.lang.apply({
					size: 300,
					min: 0,
					max: 100
				}, opts);
				
				var vocab = vocabs[!!opts.vertical * 1],
					// major tick template, this should be cloned before use
					tickMajorElm = glow.dom.create('<div class="ruler-tickMajor"></div>'),
					// minor tick template, this should be cloned before use
					tickMinorElm = glow.dom.create('<div class="ruler-tickMinor"></div>'),
					// label template, this should be cloned before use
					labelElm = glow.dom.create('<div class="ruler-label"><span></span></div>'),
					// labels converted into a number. This will be NaN for objects
					labelInterval = Number(opts.labels),
					// this is the largest incement we can use to loop
					divisor = greatestCommonDivisor(opts.tickMajor, opts.tickMinor, labelInterval),
					// percent position
					percentPos,
					// tmp holder for an element
					tmpElm,
					// a couple of shortcuts
					reverse = opts.reverse,
					// difference between max & min
					size = opts.max - opts.min,
					// container element
					element,
					// labels container
					labelsElm,
					// a tmp clone of the label elm
					labelElmClone,
					// looping vars
					labelPos,
					i = opts.min;
				
				// create element
				this.element = element = glow.dom.create('<div role="presentation" class="glow170-' + vocab.containerClassNamePart + '"><div class="ruler-spacer"></div><div class="ruler-labels"></div></div>');
				labelsElm = element.get('div.ruler-labels');
				
				// add custom ID / Class names
				element[0].id = opts.id || "";
				element[0].className += " " + (opts.className || "");
				
				for (; i <= opts.max; i += divisor) {
					// work out which pixel position we're dealing with
					percentPos = ((i - opts.min) / size) * 100;
					percentPos = reverse ? 100 - percentPos : percentPos;
					
					// vocab.pos is top or left
					
					if ( opts.tickMajor && !((i - opts.min) % opts.tickMajor) ) {
						// place a major tick
						tickMajorElm.clone().css(vocab.pos, percentPos + "%").appendTo(element);
					} else if ( opts.tickMinor && !((i - opts.min) % opts.tickMinor) ) {
						// place a minor tick
						tickMinorElm.clone().css(vocab.pos, percentPos + "%").appendTo(element);
					}
					
					if (labelInterval && !((i - opts.min) % labelInterval)) {
						// place a label
						labelElmClone = labelElm.clone().css(vocab.pos, percentPos + "%");
						// set the value as a property of the element
						labelElmClone[0]._labelVal = i;
						// set the html of the inner span. We pass the label through labelMapper if it exists
						labelElmClone.get('span').html( opts.labelMapper ? opts.labelMapper(i) : i );
						// add to labels
						labelsElm.append(labelElmClone);
					}
				}
				
				// right, our labels are set per position
				if (!labelInterval) {
					for (labelPos in opts.labels) {
						// work out which pixel position we're dealing with
						percentPos = ((Number(labelPos) - opts.min) / size) * 100;
						percentPos = reverse ? 100 - percentPos : percentPos;
						
						if (percentPos <= 100) {
							// place a label
							labelElmClone = labelElm.clone().css(vocab.pos, percentPos + "%");
							// set the value as a property of the element
							labelElmClone[0]._labelVal = Number(labelPos);
							// set the html of the inner span. We pass the label through labelMapper if it exists
							labelElmClone.get('span').html( opts.labelMapper ? opts.labelMapper(opts.labels[labelPos]) : opts.labels[labelPos] );
							// add to labels
							labelsElm.append(labelElmClone);
						}						
					}
				}
				
				// place it in the document
				container.append(element);
			};
			
		})();
		
		/*
		  This returns either the horizontal or vertical vocab.
		  A lot of lines are the same for a horizonal & vertical sliders
		  aside from a couple of keywords. The vocabs cater for these
		  keywords.
		*/
		function getVocab(slider) {
			return vocabs[!!slider._opts.vertical * 1];
		}
		
		/*
		  This adjusts size the active / inactive part of the slider, according to the handle position
		*/
		function adjustTracks(slider) {
			var vocab = getVocab(slider);
			// size the active / inactive part of the slider
			// trackToChange is _trackOnElm or _trackOffElm, length is width or height
			slider[vocab.trackToChange][0].style[vocab.length] = parseInt(slider._handleElm[0].style[vocab.pos]) + (slider._handleSize / 2) + "px";
		}
		
		/*
		  This is called as the mouse moves when the slider is being dragged
		*/
		function handleMouseMove() {
			adjustTracks(this);
			if (this._opts.changeOnDrag) {
				var newVal = valueForHandlePos(this);
				change(this, newVal);
				(this._boundInput[0] || {}).value = newVal;
			}
		}
		
		/*
		  This is called when the user interacts with the slider using keyboard (keydown)
		*/
		function handleKeyNav(event) {

			var vocab = getVocab(this),
				that = this,
				nudgeAmount;

			if (lastKeyDown == "prevented") {
				// this is a repeat of a prevented slideStart, just exit
				return false;
			} else if (lastKeyDown != event.key) {
				// this isn't a repeating keydown event, it's a new slide
				
				// if lastKeyDown isn't null, key-sliding has changed direction but not actually restarting
				if (!lastKeyDown && slideStart(this).defaultPrevented()) {
					lastKeyDown = "prevented"; //this allows us to pick up repeats
					return false;
				}
				
				nudgeAmount = (event.key == 'UP' || event.key == 'RIGHT') ? 1 : -1;
				
				// set up repeating
				// cancel any existing repeating
				clearInterval(keyRepeater);
				
				keyRepeater = setTimeout(function() {
					keyRepeater = setInterval(function() {
						nudge(that, nudgeAmount);
					}, 40);
				}, 500);
				
				// do the initial nudge
				nudge(that, nudgeAmount);
				
				// we use this to know which keyup to react to
				lastKeyDown = event.key;
			}
			return false;
		}
		/*
		  This is called when the user stops interacting with keyboard (keyup)
		*/
		function handleKeyNavEnd(event) {
			if (lastKeyDown == event.key) {
				// if lastKeyDown != event.key, sliding hasn't actually finished
				lastKeyDown = null;
				// cancel any existing repeating
				clearInterval(keyRepeater);
				// stop sliding
				slideStop(this);
			}
		}
		
		/*
			Called when the back / fwd button is pressed down
		*/
		function handleButtonDown(event) {
			if ( !this._disabled && !slideStart(this).defaultPrevented() ) {
				//work out which button was pressed
				var nudgeAmount = event.attachedTo.className.indexOf("-fwd") != -1 ? 1 : -1,
					that = this;
				
				//nudge slider
				nudge(this, nudgeAmount);
				
				//set the action to repeat
				nudgeButtonRepeater = setTimeout(function() {
					nudgeButtonRepeater = setInterval(function() {
						nudge(that, nudgeAmount);
					}, 40);
				}, 500);
			}
			return false;
		}
		
		/*
			Called when the back / fwd button is released (or mouse out)
		*/
		function handleButtonUp(event) {
			if (nudgeButtonRepeater) {
				clearTimeout(nudgeButtonRepeater);
				clearInterval(nudgeButtonRepeater);
				nudgeButtonRepeater = null;
				slideStop(this);
			}
			return false;
		}
		
		/*
			Move the slider by a step. Used by the nudge buttons and keyboard events.
			stepsToNudge = number of steps to nudge
		*/
		function nudge(slider, stepsToNudge) {
			// if the step is zero, we step by a pixel
			var changeBy = (slider._opts.step || (1 / slider._pixelsPerVal)) * stepsToNudge;
			// update the view
			slider._nudgeVal = sanitiseVal(slider, slider._nudgeVal + changeBy);
			updateSliderUi(slider, slider._nudgeVal);
			if (slider._opts.changeOnDrag) {
				change(slider, slider._nudgeVal);
				(slider._boundInput[0] || {}).value = slider._val;
			}
		}
		
		/*
			Update the slider UI for 'val', or the current value. Expects val to
			be already sanitised.
		*/
		function updateSliderUi(slider, val) {
			var valueAsPixels,
				vocab = getVocab(slider);
			
			val = val === undefined ? slider._val : val;
				
			//calculate the top / left position of the slider handle
			valueAsPixels = slider._opts.vertical ?
				// TODO copy the horizontal calculation and do the flipping afterwards
				(slider._opts.max - val) * slider._pixelsPerVal : //vertical calculation
				(val - slider._opts.min) * slider._pixelsPerVal; //horizontal calculation
			
			// move the handle
			// vocab.pos = left or top
			slider._handleElm[0].style[vocab.pos] = valueAsPixels + "px";
			
			// change track sizes
			adjustTracks(slider);
		}
		
		/*
		  Generate value based on handle position.
		  This will calculate the value and round it to the
		  nearest valid value
		*/
		function valueForHandlePos(slider) {
			var vocab = getVocab(slider),
				//get the left or top value of the handle
				handlePos = parseInt(slider._handleElm[0].style[vocab.pos]),
				//calculate value
				newVal = slider._opts.vertical ?
					(slider._trackSize - slider._handleSize) - handlePos :
					handlePos;
					
			//we've got the value from the start position in pixels, now we need the
			//value in terms of the slider
			newVal = (newVal / slider._pixelsPerVal) + slider._opts.min;
			
			//round to nearest step
			return sanitiseVal(slider, newVal);
		}
		
		/*
		  Takes a value and rounds it to the nearest value in step / slider range.
		  
		  NaN values will be treated as 0
		*/
		function sanitiseVal(slider, val) {
			var step = slider._opts.step,
				min = slider._opts.min,
				max = slider._opts.max;
			
			val = Number(val) || 0;
			
			//obey boundaries
			if (val < min) {
				return min;
			}
			if (val > max) {
				// a little more maths this time, we need to work out the maximum value we can step to
				return max - ((max - min) % (step || 1));
			}
			
			// we don't need to calculate anything if step is zero
			if (step === 0) { return val; }
			// else round to step
			return Math.round( (val - min) / step ) * step + min;
		}
		
		/*
		  Update the bound form field & fires an onchange if necessary.
		  If newVal is undefined it will be looked up (but passing in the value is faster)
		*/
		function change(slider, newVal) {
			var currentVal = slider._val;
			//calculate value if needed
			newVal = (newVal === undefined) ? valueForHandlePos(slider) : newVal;
			
			//update value
			slider.element.attr("aria-valuenow", newVal);
			slider._val = newVal;
			
			//fire onchange if we have to
			if (newVal != currentVal) {
				events.fire(slider, "change");
			}		
		}
		
		/*
		  This is called when sliding starts. Fires the start event and returns an event object
		*/
		function slideStart(slider) {
			//capture current value in case we need to reset it
			slider._valBeforeSlide = slider._nudgeVal = slider._val;
			return events.fire(slider, "slideStart");
		}
		
		/*
		  This is called when sliding stops. Fires event and resets value if default cancelled
		*/
		function slideStop(slider) {
			var eventData = {
				// current value
				initialVal: slider._valBeforeSlide,
				//get new value
				currentVal: valueForHandlePos(slider)
			};
			
			if ( events.fire(slider, "slideStop", eventData).defaultPrevented() ) {
				change(slider, slider._valBeforeSlide);
				slider.val(slider._valBeforeSlide);
				return;
			}
			change(slider, eventData.currentVal);
			//if snaping ondrop is on, update handle position with val()
			if (slider._opts.snapOnDrop) {
				slider.val(eventData.currentVal);
			} else {
				(slider._boundInput[0] || {}).value = eventData.currentVal;
			}
		}
		
		/*
		  Works out how many pixels a value is, adjust the size so ticks land
		  on pixels
		*/
		function initUi(slider, ruler) {
			var opts = slider._opts,
				//get hold of the vocab we need to use
				vocab = getVocab(slider),
				//will hold a nodelist of the slider
				element = slider.element,
				//the height of the slider when the track is 0px. Basically any padding, margins and borders
				verticalPaddingHeight,
				//adjusted size after catering for fitting ticks and steps onto pixels
				adjustedSize,
				//value the slider should start on
				startVal,
				//we listen to the mouse moving while the handle is dragging
				mouseMoveListener,
				//glow.dragDrop.Draggable instance for handle
				handleDraggable,
				//draggable options
				draggableOpts,
				//get the smallest non-zero value for step (if we're snapping while dragging), labelMinor, labelMajor
				smallestStepingVal = greatestCommonDivisor( (opts.step * opts.snapOnDrag), opts.tickMinor, opts.tickMajor ),
				oldLengthStyle;

			
			if (opts.vertical) {
				verticalPaddingHeight = element.height();
				//apply height, we need to come up with a total of opts.size
				slider._trackOnElm.height(opts.size - verticalPaddingHeight);
			} else {
				//apply width
				element.width(opts.size);
			}
			
			//vocab.length holds 'width' or 'height'
			slider._trackSize = slider._trackElm[vocab.length]();
			// get the handle size
			// right, this gets complicated in IE if the handle element has a percentage legnth, the offset values come in too late
			oldLengthStyle = slider._handleElm[0].style[vocab.length];
			if (glow.env.ie < 8) {
				slider._handleElm[0].style[vocab.length] = slider._handleElm[0].currentStyle[vocab.length];
				slider._handleElm[0].style[vocab.length] = slider._handleElm[0].style["pixel" + vocab.lengthUpper];
			}
			slider._handleSize = slider._handleElm[0]["offset" + vocab.lengthUpper];
			slider._handleElm[0].style[vocab.length] = oldLengthStyle;

			
			
			//apply the start value
			if (opts.val != undefined) { //first use the option
				startVal = opts.val;
			} else if (slider._boundInput[0] && slider._boundInput[0].value != "") { //then the form field
				startVal = slider._boundInput[0].value;
			} else { //default to min val
				startVal = opts.min;
			}
			
			/*if (slider._handleElm.css("position") != "absolute") {
				// uh oh, our CSS hasn't loaded yet
				// put in a tmp value for _pixelsPerVal, to prevent errors
				slider._pixelsPerVal = 1;
				slider._val = startVal;
				slider._trackOnElm[0].style.height = "";
				// rerun this function later
				setTimeout(function() {
					initUi(slider, ruler);
				}, 0);
				return;
			}*/
			
			//adjust size so labels / ticks sit on pixels if we have to
			if (smallestStepingVal) {
				adjustedSize =
					// get the value of a pixel
					((slider._trackSize - slider._handleSize) / (opts.max - opts.min))
					// multiple by the smallest non-zero stepping value
					* smallestStepingVal;
				
				adjustedSize =
					(
						//floor the pixel step (we don't want fractions)
						//get the new value of a pixel and work out the draggable pixel range
						(Math.floor(adjustedSize) / smallestStepingVal) * (opts.max - opts.min)
					//add on the handle size to get the new size of the inner track
					) + slider._handleSize;
					
				//apply the new size
				if (opts.vertical) {
					//apply the new size to the track
					slider._trackOnElm.height(adjustedSize);
					if (ruler) {
						ruler.element.height(adjustedSize - slider._handleSize);
					}
				} else {
					//work out the difference between the old track size and the new track size
					//apply that difference to the element width
					element.width(opts.size - (slider._trackSize - adjustedSize));
				}
				slider._trackSize = slider._trackElm[vocab.length]();
			}
			slider._pixelsPerVal = ((slider._trackSize - slider._handleSize) / (opts.max - opts.min));
			//apply the start value
			slider.val(startVal);
			
			// ARIA - initial setup
			element.attr({
				"aria-valuenow": slider._val,
				"aria-valuemin": opts.min,
				"aria-valuemax": opts.max
			});
			
			//create draggable
			draggableOpts = {
				axis: vocab.axis,
				container: slider._trackElm,
				onDrag: function() {
					if (slider._disabled || slideStart(slider).defaultPrevented()) {
						return false;
					}
					slider._stateElm.addClass("slider-active");
					mouseMoveListener = events.addListener(document, "mousemove", handleMouseMove, slider);
				},
				onDrop: function() {
					slider._stateElm.removeClass("slider-active");
					events.removeListener(mouseMoveListener);
					slideStop(slider);
				}
			};
			
			if (opts.snapOnDrag) {
				draggableOpts.step = slider._pixelsPerVal * opts.step;
			}
			
			handleDraggable = new glow.dragdrop.Draggable(slider._handleElm, draggableOpts);
			
			// track clicking
			if (opts.jumpOnClick) {
				events.addListener(slider._trackElm, "mousedown", function(event) {
					if (slider._disabled || event.source == slider._handleElm[0]) {
						// don't react if slider is disabled or handle is being used
						return;
					}
					// vocab.pos is top / left, vocab.pagePos is pageX / pageY
					var vocab = getVocab(slider),
						oldPagePos = event[vocab.pagePos];
					
					// This is a bit cheeky...
					// We're tricking the draggable into thinking the mouse is in the centre of the handle.
					// This way, all the handling of stepping and bounds is handled by the draggable
					// TODO: Move this functionality into Draggable
					event[vocab.pagePos] = slider._handleElm.offset()[vocab.pos] + (slider._handleSize / 2);
					
					// so, make the draggable think the user has clicked in the centre of it
					if (handleDraggable._startDragMouse.call(handleDraggable, event) === false) {
						// now make it think the mouse has moved
						event[vocab.pagePos] = oldPagePos;
						handleDraggable._dragMouse.call(handleDraggable, event);
						adjustTracks(slider);
						// cancel default click
						return false;
					}
				});
			}
		}
		
		/**
		@name glow.widgets.Slider
		@class
		@description Form control for setting a numerical value within a range.	

		<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
		
		@param {glow.dom.NodeList | Selector | HTMLElement} container Container of Slider.
			The Slider will be appended to this element, retaining existing contents.
			
		@param {Object} [opts] Options object
			@param {Number} [opts.size=300] Pixel width / height of the slider
				The size may be automatically reduced so that stepping sits on absolute pixels.
			@param {glow.dom.NodeList | Selector | HTMLElement} [opts.bindTo] Form element to bind value to.
				Changes to this form element will also cause the Slider to update
			@param {Number} [opts.min=0] Minimum value for slider.
				Can be negative but must be smaller than opts.max.
			@param {Number} [opts.max=100] Maximum value for slider.
				Can be negative but must be greater than opts.min.
			@param {Number} [opts.step=1] Step between values.
				0 or fractional step values may result in fractional values.
			@param {Boolean} [opts.snapOnDrag=false] If true, the slide handle will snap to each step during drag.
				This is a visual effect, it will not impact the value of the slider.
			@param {Boolean} [opts.snapOnDrop=false] If true, the slide handle will snap to a step position on drop.
				This is a visual effect, it will not impact the value of the slider.
			@param {Number} [opts.val] Start value.
				By default, the value from the bound form element will be used. If none
				exists, the minimum value will be used.
			@param {Boolean} [opts.changeOnDrag=false] Fire the 'change' event during drag.
			@param {String} [opts.id] Value for Slider's ID attribute
			@param {String} [opts.className] Values for Slider's class attribute.
				Space separated values.
			@param {Object} [opts.labels] Labels for Slider values.
				For numerical labels, a Number can be provided for the interval between labels. Text labels can
				be specified in the form <code>{"value": "label"}</code>,
				eg <code>{"0": "Min", "50": "Medium", "100": "Maximum"}</code>. Labels may contain
				HTML, so images could be used.
			@param {Number} [opts.tickMajor] The interval between each major tick mark.
			@param {Number} [opts.tickMinor] The interval between each minor tick mark.
			@param {Boolean} [opts.vertical=false] Create a vertical slider?
			@param {String} [opts.theme="light"] Visual theme to use.
				Current themes are "light" and "dark".
			@param {Boolean} [opts.jumpOnClick=true] Does the track react to clicks?
				If true, when the user clicks on the slider track the handle
				will move to that position. Dragging can be initiated from anywhere
				on the track.
			@param {Boolean} [opts.buttons=true] Include fine-tuning buttons?
			@param {Function} [opts.onSlideStart] Event shortcut.
				See documentation below
			@param {Function} [opts.onSlideStop] Event shortcut.
				See documentation below
			@param {Function} [opts.onChange] Event shortcut.
				See documentation below
	
		@example
			var mySlider = new glow.widgets.Slider("#sliderContainer", {
				min: 5,
				max: 80,
				id: "ageSlider",
				tickMajor: 5,
				tickMinor: 1,
				labels: 5
			});
		
		@example
			var mySlider = new glow.widgets.Slider("#fishLevelSlider", {
				bindTo: 'numberOfFishInTheSea',
				buttons: false,
				className: 'deepBlue',
				onSlideStart: function() {
					glow.dom.get('img#fishes').toggleCss('moving');
				},
				onSlideStop: function() {
					glow.dom.get('img#fishes').toggleCss('moving');
				},
				size: '600',
			});
		
		@example
			var mySlider = new glow.widgets.Slider("#soundLevelHolder", {
				min: 1,
				max: 100,
				id: "soundLevel",
				onChange: function () {
					updateFlash('sound', this.val());
				}
				tickMajor: 10,
				tickMinor: 5,
				labels: 5,
				vertical: true
			});

		@see <a href="../furtherinfo/widgets/slider/">Slider user guide</a>
		@see <a href="../furtherinfo/widgets/slider/style.shtml">Restyling a Slider</a>
		@see <a href="../furtherinfo/widgets/slider/colourpicker.shtml">Slider Demo: Colour Picker</a>
		*/
		/**
			@name glow.widgets.Slider#event:slideStart
			@event
			@description Fired when the user starts moving the slider.

				Fired on both keyboard and mouse interaction. Preventing the
				default will prevent the user moving the slider.
			
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.Slider#event:slideStop
			@event
			@description Fired when the user stops moving the slider.

				Fired on both keyboard and mouse interaction. Preventing the
				default will return the slider to the position it was before
				the user started dragging.
				
				The event object contains properties 'initialVal' and
				'currentVal', which contain the value before dragging and the
				value about to be set respectively.
			
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.Slider#event:change
			@event
			@description Fired when the slider value changes.

				This is usually fired when the user drops the handle, but
				can be configured to fire as the user is dragging the slider,
				via the 'changeOnDrag' option. Change also occurs when the value
				in the bound form element is changed by the user.
				
				Change does not fire when the slider's value is set via
				<code>mySlider.val()</code>.
			
			@param {glow.events.Event} event Event Object
		*/

		Slider = glow.widgets.Slider = function(container, opts) {
			//private vars
			/**
			@name glow.widgets.Sliders#_boundInput
			@type glow.dom.NodeList
			@private
			@description Element the slider is bound to.
				Can be an empty NodeList if no input was specified by the user
			*/
			/**
			@name glow.widgets.Sliders#_stateElm
			@private
			@type glow.dom.NodeList
			@description Element to apply state-related class names to, like slider-disabled
			*/
			/**
			@name glow.widgets.Sliders#_trackElm
			@private
			@type glow.dom.NodeList
			@description Element to apply state-related class names to, like slider-disabled
			*/
			/**
			@name glow.widgets.Sliders#_trackOnElm
			@private
			@type glow.dom.NodeList
			@description Element containing the "on" state of the track
			*/
			/**
			@name glow.widgets.Sliders#_trackOffElm
			@private
			@type glow.dom.NodeList
			@description Element containing the "on" state of the track
			*/
			/**
			@name glow.widgets.Sliders#_handleElm
			@private
			@type glow.dom.NodeList
			@description The slider handle
			*/
			/**
			@name glow.widgets.Sliders#_trackSize
			@private
			@type Number
			@description Pixel width / height for track
			*/
			/**
			@name glow.widgets.Sliders#_handleSize
			@private
			@type Number
			@description Pixel width / height for handle
			*/
			/**
			@name glow.widgets.Sliders#_pixelsPerVal
			@private
			@type Number
			@description How much is each pixel movement of the handle worth?
			*/
			/**
			@name glow.widgets.Sliders#_val
			@private
			@type Number
			@description Current value of the slider. Set and read by val()
			*/
			/**
			@name glow.widgets.Sliders#_valBeforeSlide
			@private
			@type Number
			@description The value of the slider when sliding last began
			*/
			/**
			@name glow.widgets.Sliders#_nudgeVal
			@private
			@type Number
			@description Sometimes we need to hold the value of the slider as it's moving.
				We don't want to set the actual val, as the change isn't over yet
			*/
			/**
			@name glow.widgets.Sliders#_disabled
			@private
			@type Boolean
			@description Is the slider disabled
			*/
			this._disabled = false;
			
			//normalise container
			container = $(container);
			
			//set up the default options
			this._opts = opts = glow.lang.apply({
				min: 0,
				max: 100,
				step: 1,
				theme: "light",
				jumpOnClick: 1,
				buttons: 1,
				size: 300
			}, opts);
			
			var i,
				//tmp holder of converted event names
				onEventName,
				//get hold of the vocab we need to use
				vocab = getVocab(this),
				//will hold a nodelist of the slider
				element,
				//the height of the slider when the track is 0px. Basically any padding, margins and borders
				verticalPaddingHeight,
				//adjusted size after catering for fitting ticks and steps onto pixels
				adjustedSize,
				//'that' for event listeners
				that = this,
				//nodelist to the back & fwd buttons
				buttonElms,
				//reference to the ticks & labels ruler used
				ruler,
				//get the smallest non-zero value for step (if we're snapping while dragging), labelMinor, labelMajor
				smallestStepingVal = greatestCommonDivisor( (opts.step * opts.snapOnDrag), opts.tickMinor, opts.tickMajor );
			
			//apply the listeners passed in through opts
			i = eventNames.length;
			while (i--) {
				//convert names. Eg "slideStart" to "onSlideStart"
				onEventName = "on" + eventNames[i].charAt(0).toUpperCase() + eventNames[i].slice(1);
				if (opts[onEventName]) {
					events.addListener(this, eventNames[i], opts[onEventName]);
				}
			}
			
			// get bound input
			this._boundInput = opts.bindTo ? $(opts.bindTo) : new glow.dom.NodeList();
			
			/**
			@name glow.widgets.Slider#element
			@type glow.dom.NodeList
			@description Slider HTML Element.
				This can be used to perform DOM manipulation on the slider
			
			@example
				//get the offset of a slider
				mySlider.element.offset();
			*/
			// add in wrapping element
			this.element = element = glow.dom.create('<div class="glow170-' + vocab.containerClassNamePart + '" tabindex="0" role="slider" aria-disabled="false">' + SLIDER_TEMPLATE + '</div>');
			this._trackElm = element.get("div.slider-track");
			this._trackOnElm = element.get("div.slider-trackOn");
			this._trackOffElm = element.get("div.slider-trackOff");
			this._handleElm = this._trackElm.get("div.slider-handle");
			this._stateElm = element.get("div.slider-state");
			
			// add in the theme
			element.get("div.slider-theme").addClass("slider-" + opts.theme);
			
			// removes buttons if the user doesn't want them
			!opts.buttons && this._stateElm.addClass("slider-noButtons");
			
			// add custom ID / Class names
			element[0].id = opts.id || "";
			element[0].className += " " + (opts.className || "");
			
			// add Ruler (ticks and labels)
			if (opts.tickMajor || opts.tickMinor || opts.labels) {
				opts.reverse = opts.vertical;
				ruler = new Ruler(element.get("div.slider-labels"), opts);
			}
			
			//add to page
			this.element.appendTo(container);
			
			initUi(this, ruler);			
			
			if (this._boundInput[0]) {
				// listen for changes
				events.addListener(this._boundInput, "change", function() {
					var snappedValue = sanitiseVal(that, this.value);
					change(that, snappedValue);
					// using val() to do the UI & value updating results in sanitise being called twice, but saves code
					that.val(snappedValue);
				});
			}
			
			// focus changes
			events.addListener(this.element, "focus", function() {
				if ( !that._disabled ) {
					that._stateElm.addClass("slider-active");
				}
			});
			
			events.addListener(this.element, "blur", function() {
				that._stateElm.removeClass("slider-active");
			});
			
			// keyboard events
			events.addListener(this.element, 'keydown', function(event) {
				if (that._disabled) { return; }
				switch (event.key) {
					case 'UP':
					case 'RIGHT':
					case 'DOWN':
					case 'LEFT':
						return handleKeyNav.call(that, event);
				}
			});
			
			events.addListener(this.element, 'keyup', function(event) {
				if (that._disabled) { return; }
				switch (event.key) {
					case 'UP':
					case 'RIGHT':
					case 'DOWN':
					case 'LEFT':
						return handleKeyNavEnd.call(that, event);
				}
			});
			
			// the following prevents the arrow keys scrolling in some browsers (such as Opera)
			events.addListener(this.element, 'keypress', function(event) {
				if (that._disabled) { return; }
				switch (event.key) {
					case 'UP':
					case 'RIGHT':
					case 'DOWN':
					case 'LEFT':
						return false;
				}
			});
			
			// nudge buttons
			buttonElms = this.element.get(".slider-btn-fwd, .slider-btn-bk");
			events.addListener(buttonElms, "mousedown", handleButtonDown, this);
			events.addListener(buttonElms, "mouseup", handleButtonUp, this);
			events.addListener(buttonElms, "mouseout", handleButtonUp, this);
			
			// label clicking
			if (ruler) {
				events.addListener(ruler.element, "mousedown", function(event) {
					// exit if slider disabled
					if (that._disabled) { return; }
					
					var labelElm = $(event.source),
						snappedValue;
					
					// right, we need to turn labelElm (currently the event source) into the label element
					while ( labelElm[0] != ruler.element[0] ) {
						if ( labelElm.hasClass("ruler-label") ) { // yey, we found the label
							// check the value is valid
							snappedValue = sanitiseVal(that, labelElm[0]._labelVal);
							change(that, snappedValue);
							// update UI
							that.val(snappedValue);
							return false;
						}
						labelElm = labelElm.parent();
					}
					// the user must have clicked outside a label
				});
			}
		};
		
		Slider.prototype = {
			/**
			@name glow.widgets.Slider#disabled
			@function
			@description Get / Set the disabled state of the slider
				Call without parameters to get the state, call with parameters
				to set the state.
				
				Disabling the slider will also disable the bound form element.
			
			@param {Boolean} [disable] Disable the slider?
				'false' will enable a disabled slider.
			
			@returns
				The slider instance when setting. Boolean when getting.
				
			@example
				// disabling a slider
				mySlider.disabled( true );
				
				// toggling a slider
				mySlider.disabled( !mySlider.disabled() )
			*/
			disabled: function(disable) {
				if (disable !== undefined) {
					// setting...
					
					// cast to boolean and set
					this._disabled = disable = !!disable;
					
					// ARIA update
					this.element.attr("aria-disabled", disable);
					
					// add / remove the disabled class
					this._stateElm[disable ? "addClass" : "removeClass"]("slider-disabled");
					
					//disable the bound form field, if it's there
					( this._boundInput[0] || {} ).disabled = disable;
					
					return this;
				} else {
					// getting...
					return this._disabled;
				}
			},
			/**
			@name glow.widgets.Slider#val
			@function
			@description Get / Set the value the slider
				Call without parameters to get the value, call with parameters
				to set the value.
			
			@param {Number} [newVal] New value for the slider
			
			@returns
				The slider instance when setting. Number when getting.
				
			@example
				// getting the current value
				var sliderVal = mySlider.val();
				
				// setting the value
				mySlider.val(50);
			*/
			/*
			This param is a possible future enhancment
			 
			@param {glow.anim.Animation | Boolean} [anim] Animate the slider to the new value.
				Ommiting this parameter will simply switch the slider to the new value.
				
				True will create a basic easing animation, or a custom animation can
				be provided.
				
				Animating to a new value simulates human interaction. The usual events
				will be fired along the way.
			*/
			val: function(newVal) {
				if (newVal != undefined) {
					//setting...
					
					//sanitise and set
					this._val = sanitiseVal(this, newVal);
					//update aria
					this.element.attr("aria-valuenow", this._val);
					//update form
					(this._boundInput[0] || {}).value = this._val;
					//update UI
					updateSliderUi(this);
					
					return this;
				} else {
					return this._val;
				}
			},
			/**
			@name glow.widgets.Slider#valToLabel
			@function
			@description Get the label for a value.
			
			@param {Number} [val] The value.
				If omitted, the current slider value is used.
			
			@returns {String}
				Label text.
				
			@example
				// find out the label the handle is nearest
				var label = mySlider.valToLabel();
			*/
			valToLabel: function(val) {
				// pick the value up from the slider if there are no params
				if (val === undefined) {
					val = this._val;
				}
				
				var labels = this._opts.labels,
					// the lowest difference between labels
					lowestDiff = Infinity,
					// the lowest different passed through Math.abs
					lowestDiffAbs = Infinity,
					// label that has the lowest differece
					currentLabel,
					// tmp value
					diffAbs,
					i;
				
				// return null if there are no labels
				if (labels === undefined) { return null; }
				
				// look out for interval labels
				if (typeof labels == 'number') {
					// round to the nearest interval label
					return Math.round(val / labels) * labels;
				}
				
				// deal with object labels
				// is the value the actual position of a label? If so return it
				if (labels[val]) {
					return labels[val];
				}
				
				// bah, we have to look for the closest label
				for (i in labels) {
					// get the difference between the label and value
					diffAbs = Math.abs(Number(i) - val);
					
					if (diffAbs < lowestDiffAbs) {
						// the difference is less than ones found previously, we have a new winner
						lowestDiffAbs = diffAbs;
						lowestDiff = Number(i) - val;
						currentLabel = labels[i];
					} else if (diffAbs == lowestDiffAbs) {
						// uh oh, we have two diffs the same. Round up!
						if (lowestDiff < 0) {
							lowestDiffAbs = diffAbs;
							lowestDiff = Number(i) - val;
							currentLabel = labels[i];
						}
					}
				}
				return currentLabel;
			},
			/**
			@name glow.widgets.Slider#labelToVal
			@function
			@description Get the value for a particular label.
				If the label doesn't exist in the slider, null is returned
			
			@param {String} [label] A label used in the slider
			
			@returns {Number}
				Value.
				
			@example
				// find out that value of "Medium" on the slider
				var val = mySlider.labelToVal("Medium");
			*/
			labelToVal: function(label) {
				var i,
					labels = this._opts.labels;
				
				// return null if there are no labels
				if (labels === undefined) { return null; }
				
				// look out for interval labels
				if (typeof labels == 'number') {
					label = Number(label);
					
					// if the label is divisable by the interval, return it
					if ( !(Number(label) % labels) && !isNaN(label) ) {
						return label;
					}
					return null;
				}
				
				// loop through the objects until we find a match
				for (i in labels) {
					if (label == labels[i]) {
						return Number(i);
					}
				}
				return null;
			}
		};
	}
});

(window.gloader || glow).module({
	name: 'glow.widgets.AutoSuggest',
	library: ['glow', '1.7.0'],
	depends: [[
		'glow', '1.7.0',
		'glow.dom',
		'glow.events',
		'glow.anim',
		'glow.widgets',
		'glow.net',
		'glow.widgets.Overlay'
	]],
	
	builder: function(glow) {
/* private fields *************************************************************/
		var $      = glow.dom.get, // shortcuts
			events = glow.events,
			anim   = glow.anim;
			
/* private functions **********************************************************/
		/**
			@private
			@description Attach a text input element to this AutoSuggest instance.
		 */
		 function bindTo(that, inputElement) {
			that.inputElement = $(inputElement);
			if (!that.inputElement[0].tagName.toLowerCase() == 'input') {
				throw 'Argument "inputElement" must be set to an input HTMLElement.';
			}
			
			that.inputElement.attr('autocomplete', 'off'); // stop arrow keys from doing browsery things
		}
		
		/**
			@private
			@description Uses AJAX to refresh the data from a server URL.
		 */
		function downloadData(that, url, callback) { /*debug*///console.log("downloadData("+url+", "+callback+")");
			if (that._lastDownload == url) { // no need to reload same url again
				if (callback) callback.apply(that, arguments);
				else that.find();
			}
			else {
				that._lastDownload = url;
				
				if (that._pendingRequest) that._pendingRequest.abort();
				that._pendingRequest = glow.net.get(
					url,
					{
						useCache: that.opts.useCache,
						onLoad: function(r) {
							var dataObject = (that.opts.parseData)? that.opts.parseData.apply(that, [r]) : eval(r.text());
							
							that._pendingRequest = null;
							that.setData(dataObject);
							
							// create and populate Event instance
							var e = new events.Event();
							e.data = dataObject;
							e.text = r.text();
							events.fire(that, 'dataLoad', e);
					
							if (callback) callback.apply(that, arguments);
							else that.find();
						},
						onError: function(r) {
							var e = new events.Event();
							e.response = r;
							events.fire(that, 'dataError', e);
						},
						onAbort: function(r) {
							var e = new events.Event();
							e.response = r;
							events.fire(that, 'dataAbort', e);
						}
					}
				);
			}
		}
		
		/**
			@private
			@description Check whether the overlay is currently visible.
			@type {Boolean}
		 */
		function isVisible(that) {
			return ($(that.overlay.container).css('display') == 'block');
		}
		
		/**
			@private
			@description Position the overlay under the input element.
		 */
		function place(that) {
			if (!that.opts.autoPosition) { return; }
			
			var inputOffset = that.inputElement.offset();

			that.overlay.container
			.css('left', inputOffset.left + 'px')
			.css('top', inputOffset.top + that.inputElement[0].offsetHeight + 'px')
			.css('width', ((that.opts.width)? that.opts.width : that.inputElement[0].offsetWidth + 'px'));
		}
		
		/**
			@private
		 */
		function buildIndexer(that) { // create a custom one from an opt value
			if (that.opts.index) {
				if (typeof that.opts.index == 'function') {
					that._indexer = that.opts.index; // it's up to the user
				}
				else if (typeof that.opts.index == 'string') { // it's a field name
					that._indexer = (function(index) {
						return function(dataItem) {
							return dataItem[index]
						}
					})(that.opts.index);
				}
				else if (that.opts.index.push !== undefined) { // it's an array of field names
					that._indexer = (function(index) {
						var l = index.length-1; // assumes the index length never changes
						return function(dataItem) {
							var result = [];
							for (var i = l; i >= 0; i--) {
								result[i] = dataItem[index[i]];
							}
							return result;
						}
					})(that.opts.index);
				}
				else throw 'opts.index must be of type function, string or array, not ' + typeof that.opts.index + '.';
			}
			else { // default
				that._indexer = function (dataItem) { // the default indexer
					return (dataItem['name'])? dataItem['name'] : dataItem.toString(); // TODO: what if there is no 'name' field?
				}
			}
		}
		
		/**
			@private
			@description Make the next item in the results active.
		 */
		function nextItem(that) {
			var currItem = $(that.overlay.container).get('.active');
			
			if (currItem.length == 0) {
				var items = $(that.overlay.container).get('li'); // TODO
				if (items.length) activateItem(that, items[0]);
			}
			else {
				var nextItem = currItem.next();
			
				if (nextItem && !nextItem.is('ul')) {
					deactivateItem(that, currItem);
					activateItem(that, nextItem);
				}
				else { // move selection down off of suggestion list, back into the input element
					that.val(that._original);
					deactivateItem(that, currItem);
				}
			}
		}
		
		/**
			@private
			@description Make the previous item in the results active.
		 */
		function prevItem(that) {
			var currItem = $(that.overlay.container).get('.active');
			
			if (currItem.length == 0) { // no item is active so return the last item
				var allItems = $(that.overlay.container).get('li');
				var lastItem = allItems[allItems.length-1];
				activateItem(that, lastItem);
			}
			else {
				var prevItem = currItem.prev();
				
				if (prevItem && !prevItem.is('ul')) {
					deactivateItem(that, currItem);
					activateItem(that, prevItem);
				}
				else { // move selection up off of suggestion list, back into the input element
					that.val(that._original);
					deactivateItem(that, currItem);
					that._lastActive = -1;
				}
			}
		}
		
		/**
			@private
			@description Given an HTML element, return this AutoSuggest list.
		 */
		function getParentListItem(that, node) { /*debug*///console.log("getParentListItem("+node+")");
			var listItem = node;
			while (listItem.parentNode && listItem.parentNode.parentNode) {
				if ($(listItem.parentNode.parentNode).hasClass('glow170-autoSuggest')) break;
				listItem = listItem.parentNode;
			}
			return (listItem.nodeName.toLowerCase() == 'li')? listItem : null;
		}
		
		/**
			@private
			@description Make the given list item from the results active.
		 */
		function activateItem(that, listItem) {
			deactivateItems(that, listItem);
			$(listItem).addClass('active');
			
			if (that._lastActive != listItem) {
				that._lastActive = listItem;	
				events.fire(that, 'itemActive');
			}
		}
		
		/**
			@private
			@description Make the item from the results at the given offeset active.
		 */
		function activateItemOffset(that, offset) {
			var li = that.overlay.container.get('li')[offset]; // TODO
			if (li) $(li).addClass('active');
		}
		
		/**
			@private
			@description Make the given list item not active.
		 */
		function deactivateItem(that, listItem) {
			$(listItem).removeClass('active');
		}
		
		/**
			@private
			@description Make all list items not active.
		 */
		function deactivateItems(that, listItem) {
			var list = (listItem) ? $(listItem).parent() : that.overlay.container.get('ul');
			list.get("li").each(
				function(i) {
					$(this).removeClass('active');
				}
			);
		}
		
		
		/**
			@name glow.widgets.AutoSuggest#event:show
			@event
			@description Fired when the suggestion list is about to open.
			@param {glow.events.Event} event Event Object
		*/
		/**
			@name glow.widgets.AutoSuggest#event:hide
			@event
			@description Fired when the suggestion list is about to close.
			@param {glow.events.Event} event Event Object
		*/
		/**
			@private
			@description Used internally to add all necessary events.
		 */
		function addEvents(that) { /*debug*///console.log('addEvents()');
			// make show or hide events from the overlay bubble up to AutoSuggest
			var bubble = function(e) {
				glow.events.fire(that, e.type, e);
				return !e.defaultPrevented();
			};
			events.addListener(that.overlay, 'show', bubble);
			events.addListener(that.overlay, 'hide', bubble);
			
			events.addListener( // a result item has become active
				that,
				'itemActive',
				function(e) { // fire any onItemActive handlers in the opts
					if (!isVisible(that)) return false;						
					var selectedOffset = that.getSelectedOffset();
					if (selectedOffset == -1) return false;
					
					if (that.opts.onItemActive) {
						var e = new events.Event();
						e.activeItem = that._found[selectedOffset];
						that.opts.onItemActive.apply(that, [e]);
					}
					
					return true;
				}
			);
			
			events.addListener( // the mouse was clicked inside the input element
				that.inputElement,
				'mousedown',
				function(e) { // bail, but keep any hilighted suggestion
					clearTimeout(that.findTimeout);
					
					// user accepts the hilited text
					that._value = that.inputElement.val();
					valueChanged(that, true);
					
					that.hide();
					
					that.value += that._selected;
					that._selected = '';
					
					return true;
				}
			);
			
			events.addListener( // a result item was selected
				that,
				'itemSelect',
				function(e) { // fire any onItemSelect handlers in the opts
					if (!isVisible(that)) return false;
						
					var selectedOffset = that.getSelectedOffset();
					if (selectedOffset == -1) return false;
					
					var e = new events.Event();
					e.source = $(that.overlay.container).get('.active');
					e.selectedItem = that._found[selectedOffset];
					if (that.opts.onItemSelect) {
						that.opts.onItemSelect.apply(that, [e]);
						
					}
					setCaretTo(that.inputElement[0], that.inputElement.val().length);

					valueChanged(that, /*without finding?*/true);
					
					that.hide();
					return true;
				}
			);
			
			events.addListener( // the list of results was clicked (and thus a result item was selected)
				that.overlay.container.get('ul')[0],
				'mousedown',
				function(e) {
					events.fire(that, 'itemSelect', e);
				}
			);


			events.addListener( // the window was resized while the results were showing?
				window,
				'resize',
				function(e){
					place(that);
				}
			);
			
			// some code wot jake done wrote:
			// prevent moz from hiding the input box when a link in the results is clicked
			events.addListener(that.overlay.container, 'mousedown', function() {
				return false;
			});
			// same for IE...
			events.addListener(that.overlay.container, 'beforedeactivate', function(event) {
				if ($(event.nativeEvent.toElement).isWithin(that.overlay.container)) {
					return false;
				}
				return true;
			});
			
			events.addListener( // the focus has moved away from the input element
				that.inputElement,
				'blur',
				function(e) { /*debug*///console.log("blur("+e+")");
					clearTimeout(that.findTimeout);
					
					// user accepts the hilited text
					that._value = that.inputElement.val();
					valueChanged(that, true);
						
					that.hide();
				}
			);
			
			events.addListener( // the cursor is over a result item
				that.overlay.container,
				'mouseover',
				function(e) { /*debug*///console.log("mouseover("+e+")");
					var li = getParentListItem(that, e.source);
					li && activateItem(that, li);
				}
			);
			
			events.addListener( // the cursor has left a result item
				that.overlay.container,
				'mouseout',
				function(e) { /*debug*///console.log("mousmouseouteover("+e+")");
					var li = getParentListItem(that, e.source);
					if (li && li != e.source) deactivateItem(that, li);
				}
			);
			
			var ignoreInUp = false; // flag to tell the keyup handler if it should ignore already-handled key presses
			var repeating = {ondown:0, onpress:0};
			
			function keyDownHandler(e) { /*debug*///console.log("keydown "+e.key);
				clearTimeout(that.findTimeout); // kill any pending finds whenever a new key is pressed
				
				ignoreInUp = false;
				repeating.ondown++;
				
				switch (e.key) {
					case 'DOWN':
						if (isVisible(that)) {
							ignoreInUp = true; 
							nextItem(that);
							return false; // on some systems this moves the carat around
						}
						break;
					case 'UP':
						if (isVisible(that)) {
							ignoreInUp = true;
							prevItem(that);
							return false;
						}
						break;
					case 'LEFT':
					case 'RIGHT':
						if (isVisible(that)) {
							// user accepts the highlighted text
							that._value = that.inputElement.val();
							valueChanged(that, true);
						}
						break;
					case 'ESC':
						// return to the value originally entered by the user
						that.inputElement.val(that._original);
						that._value = that._original;
						valueChanged(that, true);
						that.hide();
						return false;
					case 'DEL':
					case 'BACKSPACE':
						that.hide();
						break;
					case 'ENTER':
						if (isVisible(that)) {
							ignoreInUp = true;
						}
						else {
							return true; // no: the results aren't visible so just do the default thing
						}
						
						var selectedOffset = that.getSelectedOffset();
						if (selectedOffset == -1) { // no: there isn't any result item selected
							that.hide();
							return true; // do the default thing
						}
						
						// yes: fire the itemSelect event
						var e = new events.Event();
						e.source = $(that.overlay.container).get('.active');
						e.selectedItem = that._found[selectedOffset];
						events.fire(that, 'itemSelect', e);
						return false; // return false to prevent form submitting?
				}
				
				// if we're still here...
				return true;
			}
			events.addListener(that.inputElement[0], 'keydown', keyDownHandler);
			
			function keyPressHandler(e) { /*debug*///console.log("keypress "+e.key);
				repeating.onpress++;
				
				// For non-printable characters, like arrow keys...
				// Some browsers (like Mac Safari 3.1.1) only ever fire the keydown event
				// (even for auto-repeats) and never fire the keypress event.
				// Some browsers fire the keydown event only once and then fire the
				// keypress event repeatedly until the key is released.
				// We need to deal with both possibilities but we must not
				// handle the event twice.
				
				// We do nothing the very first time we get here, because the event must
				// have already been handled in previous keydown phase.
				// But if we've passed here more than once, oafter a single keydown, 
				// we must be repeating on keypress, so it's ok to handle it from now on.
				if (repeating.ondown == 1 && repeating.onpress > 1) {
					if (e.key == 'DOWN') {
						if (isVisible(that)) {
							nextItem(that);
						}
						return false;
					}
					else if (e.key == 'UP') {
						if (isVisible(that)) {
							prevItem(that);
						}
						return false;
					}	
				}
				
				return true;
			}
			events.addListener(that.inputElement[0], 'keypress', keyPressHandler);
			
			
			function keyUpHandler(e) { /*debug*///console.log("keyUpHandler(e)");
				repeating = {ondown:0, onpress:0}; // not repeating anymore
				
				if (ignoreInUp) return false;

				that._value = that.inputElement.val(); // stow the new value from the input element
				
				valueChanged(that);				
				
				return true;
			}
			events.addListener(that.inputElement[0], 'keyup', keyUpHandler);
		}
		
		/**
			@private
			@description What to do when the value in the input element changes.
		 */
		function valueChanged(that, withoutFinding) { /*debug*///console.log("valueChanged(that, "+withoutFinding+")");
			if (that._oldValue === undefined)  that._oldValue = that.inputElement.val(); // initially
			var currentValue = that.getValue(); // grab value, so we can send it with the event

			/*debug*///console.log("oldValue is '"+that._oldValue+"'; currentValue is '"+currentValue+"';");

			var skipFind = false;
			if (currentValue == '') {
				skipFind = true; // in case user has deleted last remaining character
				that.hide(); // in case user has used keyboard to cut out all characters in the input item
			}
			else if (currentValue.toLowerCase() == that._oldValue.toLowerCase()) {
				skipFind = true;
			}
		
			that._oldValue = currentValue;
				
			if (withoutFinding || skipFind) return;

			that.findTimeout = setTimeout(
				function() {
					var e = new glow.events.Event();
					e.value = currentValue;
					glow.events.fire(that, 'inputChange', e);
					
					if (that.opts.activeOnShow !== false) { activateItemOffset(that, 0); }

					if (!e.defaultPrevented()) { // user can cancel the find in their handler
						if (typeof that.dataSource != 'object') that.loadData(); // urls and functions are always reloaded
						that.find();
					}
				},
				500
			);
		}
			
/* constructor ****************************************************************/

		/**
		  @name glow.widgets.AutoSuggest
		  @constructor
		  @description Create an auto-suggest menu for an input element.
		  
		  An AutoSuggest widget adds the ability for a text input element to make
		  suggestions whilst the user types. This appears as a list of selectable
		  items below the input element which dynamically updates based on what
		  has been typed so far.

		  <div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
		  
		  @param {glow.dom.NodeList | String} inputElement A NodeList or css selector that points to a text input element.
		  @param {Object[] | String[] | String | Function} dataSource Either an array of objects, an array of strings (referred to as a 'dataSource'), a function that returns a dataSource or a URL that when requested will return a dataSource.
		  @param {Object} opts Optional configuration settings.
			@param {String[] | Function} [opts.index=["name"]] When datasource is an array of objects, the property with this string is used as the index, or this function will be used to generate the index.
			@param {Number} [opts.width=inputElement width] Width in pixels of the suggestion container. Default is the width of the inputElement.
			@param {Number} [opts.height] Height in pixels of the suggestion container.
			@param {Function} [opts.parseData] Transform the response from the server into a dataSource object.
				The server may return XML or even plain text, but your parseData function should convert this
				data into an array of objects.
				
				Your function will be passed a {@link glow.net.Response} object from the server.
				
			@param {Function} [opts.formatItem] Given the matched data item, return HTML or NodeList.
			@param {Boolean} [opts.autoPosition=true] Automatically position the suggestion list under the input element.
				If you set autoPosition to false, you can position the suggestion list yourself in a handler for the show event of your AutoSuggest object. 
			@param {Boolean} [opts.activeOnShow=true] Should the first suggestion automatically be active when the suggestion list appears?
			@param {Number} [opts.maxListLength] Limit the size of the result list to this.
			@param {Boolean} [opts.caseSensitive=false] Whether case is important when matching suggestions.
			@param {Function} [opts.isMatch] Provide a custom function to filter the dataset for results
				Your function will be passed an indexed term and the term entered by the user, return
				true to confirm a match.
				
				The default function will check the indexed term begins with the term entered by the user.
			@param {Boolean} [opts.complete=false] Append the completed text of the currently active suggestion to the input text.
			@param {String} [opts.delim] When defined, the input text will be treated as multiple values, separated by this string (with surrounding spaces ignored).
			@param {string} [opts.theme="light"] Either "light" or "dark".
			@param {String|Function} [opts.anim] Passed into the Overlay constructor for show and hide transitions.
			@param {Function} [opts.onInputChange] Your own handler for the inputChange event.
			@param {Function} [opts.filter] Filter matches found before they're displayed.
				
				Provide a callback function that can be used to modify an array of
				matching results before they are displayed. The callback receives a
				single argument, an array of objects corresponding to the objects in
				your data that are considered to match; expects you to return an array
				of objects modified as you wish.
				
			@param {Boolean} [opts.useCache=false] Allow results to cache when using a url dataSource
				If false, a random number will be added to the URL to ensure the
				results do not come from the browser's cache.
			@param {Boolean} [opts.selectCompletedText=true] Set to false to prevent the widget from highlighting the completed text in the input element by selecting it.
			
			@param {Function} [opts.onItemSelect] Your own handler for the itemSelect event.
			@param {Function} [opts.onDataLoad] Your own handler for the dataLoad event.
			@param {Function} [opts.onDataError] Your own handler for the dataError event.
			@param {Function} [opts.onDataAbort] Your own handler for the dataAbort event.
	  
		  @see <a href="../furtherinfo/widgets/autosuggest/">AutoSuggest user guide</a>

		  @example

			new glow.widgets.AutoSuggest(
				"#inputElementId",  // HTML input element to bind the AutoSuggest to
				["Apple Flan", "Easy Shortbread", "Apple FlapJack", "Flambe of Brandied Apple Ice"] // Data source
			);

		  @example

			myOpts = {
				width: 100,
				theme: "dark",
				maxListLength: "10",
				onItemSelect: function(e) {
					this.val(e.selectedItem.name); // Updates the binded HTML input element with the selected value
				}
			}

			myData = [
					{
							name: "Apple Flan"
					},
					{
							name: "Easy Shortbread"
					},
					{
							name: "Apple FlapJack"
					},
					{
							name: "Flambe of Brandied Apple Ice"
					}
			];

			myAutoSuggest = new glow.widgets.AutoSuggest(
				"#inputElementId", // HTML input element to bind the AutoSuggest to
				myData,
				myOpts
			);

		  @example

			new glow.widgets.AutoSuggest(
				myInputElement,  // HTML input element to bind the AutoSuggest to
				"colornames.js", // URL to data
				myOpts
			).loadData(); // load data from URL now

		*/
		/**
		@name glow.widgets.AutoSuggest#event:inputChange
		@event
		@description Fired whenever new suggestion appears based on changed input.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.AutoSuggest#event:itemSelect
		@event
		@description Fired whenever a suggestion is selected.

		@param {glow.events.Event} event Event Object
		@param {Object} event.selectedItem The object in the dataSource that is associated with the selected list item.
		*/
		/**
		@name glow.widgets.AutoSuggest#event:dataLoad
		@event
		@description Fired whenever raw data is loaded from a request to a URL.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.AutoSuggest#event:dataError
		@event
		@description Fired whenever there is an errored request to a URL.
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.AutoSuggest#event:dataAbort
		@event
		@description Fired whenever there is an aborted request to a URL.
		@param {glow.events.Event} event Event Object
		*/
		glow.widgets.AutoSuggest = function(inputElement, dataSource, opts) { /*debug*///console.log('new glow.widgets.AutoSuggest('+inputElement+', '+dataSource+', '+opts+')');
			this.opts = opts || {};
			
			bindTo(this, inputElement);
						
			this.overlay = new glow.widgets.Overlay(
				glow.dom.create('<div class="glow170-autoSuggest"><ul></ul></div>'),
				{
					autoPosition: false,
					anim: (this.opts.anim)? this.opts.anim : null
				}
			);
		
			this.configure(this.opts);
			buildIndexer(this); // build the function that will be used to create an index from the data
			
			this.dataSource = dataSource;
			this.data = [];
			if (typeof dataSource != 'string') this.loadData(); // urls are not loaded on construct, objects and functions are
			
			addEvents(this);
			
			if (this.opts.complete) {

				// Fix for trac 175 - "Autosuggest opens overlay onLoad where opts.complete == true"
				if (this.inputElement.val() == '') {
					this.setData(dataSource);
				}
				else {
					this.setData(dataSource, function() {});
				}
				
				var that = this;

				events.addListener(
					that,
					'itemActive',
					function(e) {
						var selectedOffset = that.getSelectedOffset();
						if (selectedOffset == -1) return false;
						var matchedOn = (that._found[selectedOffset][this.opts.index]||that._found[selectedOffset]['name']||that._found[selectedOffset]);
						if (matchedOn.push !== undefined) matchedOn = that._matchedOn;
						that.suggest(matchedOn);
						
						return true;
					}
				);
			}
			
			this.opts.selectCompletedText =
				(opts.selectCompletedText === undefined)? true : opts.selectCompletedText;
		}

/* public fields *************************************************************/

		/**
		  @name glow.widgets.AutoSuggest#inputElement
		  @type glow.dom.NodeList
		  @description Refers to the input element to which this is attached to.
		  @example

		  var myAutoSuggest = new glow.widgets.AutoSuggest(
			"input#preferedColour",
			"colornames.js"
		  );
		  alert(myAutoSuggest.inputElement); // returns a nodeList referencing input#preferedColour

		 */
		 
		 /**
		  @name glow.widgets.AutoSuggest#overlay
		  @type glow.widgets.Overlay
		  @description Refers to the overlay object that will contain the list of suggestions.
		  @example

		  var myAutoSuggest = new glow.widgets.AutoSuggest(
			"input#preferedColour",
			"colornames.js"
		  );
		  myAutoSuggest.overlay.show();

		 */
		
/* public methods *************************************************************/
		
		/**
			@private
			@description Used internally to apply configuration options.
		 */
		glow.widgets.AutoSuggest.prototype.configure = function(opts) {
			this.opts = opts || {};
			
			if (this.opts.autoPosition === undefined) { this.opts.autoPosition = true; }
			if (this.opts.height) {
				var listContainer = $(this.overlay.container.get('.glow170-autoSuggest').get('ul')[0]);
				listContainer.css('overflow-x', 'hidden');
				listContainer.css('overflow-y', 'auto');
				listContainer.height(this.opts.height);
			}
			
			if (this.opts.theme == 'dark') {
				$(this.overlay.container.get('ul')[0]).removeClass('autosuggest-light');
				$(this.overlay.container.get('ul')[0]).addClass('autosuggest-dark');
			}
			else {
				$(this.overlay.container.get('ul')[0]).removeClass('autosuggest-dark');
				$(this.overlay.container.get('ul')[0]).addClass('autosuggest-light');
			}
			
			if (this.opts.onDataLoad)    events.addListener(this, 'dataLoad', this.opts.onDataLoad);
			if (this.opts.onDataError)   events.addListener(this, 'dataError', this.opts.onDataError);
			if (this.opts.onDataAbort)   events.addListener(this, 'dataAbort', this.opts.onDataAbort);
			if (this.opts.onInputChange) events.addListener(this, 'inputChange', this.opts.onInputChange);
							
			this._isMatch =  this.opts.isMatch || function(word, lookFor) { return (word.indexOf(lookFor) == 0); } // default
			this._formatItem = this.opts.formatItem || function(o) { return (o.name)? o.name : o.toString(); }; // default
			this._matchItem = this.opts.formatItem || function(o) { return o.name; }; // default
			this._filter = this.opts.filter || function(results) { return results; }; // do nothing
		}
		
		/**
			@name glow.widgets.AutoSuggest#setData
			@function
			@description Update the data source
			
				If the dataSource is a URL it will be reloaded asynchronously.
				
			@param {Object[] | String | Function} dataSource New data source
			@type {glow.widgets.AutoSuggest}
			@returns The instance of the widget.
			@example
				myAutoSuggest = new glow.widgets.AutoSuggest(
					myInputElement,
					"colornames.js", // URL to data
					myOpts
				)
				myAutoSuggest.setData("newColornames.js"); // Set data to new URL
				myAutoSuggest.loadData(); // load data from new URL now
		 */
		glow.widgets.AutoSuggest.prototype.setData = function(dataSource, callback) { /*debug*///console.log("setData("+((dataSource)?dataSource.toSource():"")+")");
			if (typeof dataSource == 'function') {
				dataSource = dataSource.call(this);
			}
			
			if (typeof dataSource == 'string') { // it's a URL but next time through we'll have an actual object, not a string
				this.dataURL = dataSource;
				this.data = []; // placeholder value until download completes
				
				// insert the current value of the input element to pass to the server
				dataSource = dataSource.replace(/\{input\}/g, escape(this.getValue()));
				downloadData(this, dataSource, callback); // calls setData
			}
			else {
				this.data = dataSource;
			
				// process data to build a results_array and an index like {"keyword": results_array_offsets[]}
				this.index   = {};
				this.results = [];
				
				// this._indexer is a function to extract the keywords from each data item
				for (var d = 0; d < this.data.length; d++) {
					var datum = this.data[d];
					this.results.push(datum);
				
					// build index keywords
					var keywords = this._indexer(datum);
					keywords = (typeof keywords == 'string')? [keywords] : keywords;
					
					// associate data items with keyword
					for (var i = 0; i < keywords.length; i++) {					
						var keyword   = "="+(this.opts.caseSensitive? String(keywords[i]) : String(keywords[i]).toLowerCase());
						if (!this.index[keyword]) this.index[keyword] = [];
						this.index[keyword].push(this.results.length-1);
					}
				}
				
				return this; // chained
			}
		}
		
		/**
			@name glow.widgets.AutoSuggest#loadData
			@function
			@description Cause the dataSource passed to the constructor to be set as the current data.
			@type {glow.widgets.AutoSuggest}
			@returns The instance of the widget.
			@example
				new glow.widgets.AutoSuggest(
					myInputElement,
					"colornames.js", // URL to data
					myOpts
				).loadData(); // load data from URL now
		 */
		glow.widgets.AutoSuggest.prototype.loadData = function(callback) { /*debug*///console.log("loadData()");
			this.setData(this.dataSource, callback);
			return this; // chained
		}
		
		/**
			@private
			@description Used to create a sting that combines a completetion with existing text.
		 */
		function appendTag(currentValue, delim, value) {  /*debug*///console.log("called appendTag('"+currentValue+"', '"+delim+"', '"+value+"')");
			var split;
			if (delim == '' || currentValue.indexOf(delim) < 0) {
				split = new RegExp('^( *)(.*)$');
			}
			else {
				split = new RegExp('^(.*'+delim+' *)([^'+delim+']*)$');
			}
			
			var lv = split.exec(currentValue)[1];
			var rv = (split.exec(value)||["", "", value])[2];

			return lv+rv;
		}
		
		/**
			@name glow.widgets.AutoSuggest#val
			@function
			@param {string} [value] If defined this value is set, otherwise the current value is returned.
			@description Sets or gets the value of the input element (minus any unaccepted completions).
			@type {String|glow.widgets.AutoSuggest}
			@returns The value of the input element when getting, or the instance of the widget when setting.
			@example
				new glow.widgets.AutoSuggest(
					"input#recipeName",  // refers to an input element on the page
					["Apple Flan", "Easy Shortbread", "Apple FlapJack", "Flambe of Brandied Apple Ice"], // Data source
					{
						onItemSelect: function(e) {
							this.val(e.selectedItem.name); // Set input#reciptName to the value of the selected item
						}
					}
				);
		 */
		glow.widgets.AutoSuggest.prototype.val = function(value) { /*debug*///console.log("called val("+value+")");
			if (value === undefined) { //set
				return this._value;
			}
			else {
				this._value = value;
				this.inputElement.val(value);
				return this; // chained
			}
		}
		
		/**
			@private
			@name glow.widgets.AutoSuggest#setValue
			@function
			@description Sets the current value of the widget. In the case of
			the delim option, set the last delimited item.
		 */
		glow.widgets.AutoSuggest.prototype.setValue = function(value) { /*debug*///console.log("called setValue("+value+")");
			var currentValue = this._value || this.inputElement.val();
			var delim = (this.opts.delim || '');
			value = appendTag(currentValue, delim, value);
			
			this._value = value;
			this.inputElement.val(value);
		}
		
		/**
			@private
			@name glow.widgets.AutoSuggest#getValue
			@function
			@description Returns the current value of the widget. In the case of
			the delim option, gets the last delimited item.
		 */
		glow.widgets.AutoSuggest.prototype.getValue = function() { /*debug*///console.log("getValue()");
			var value = this._value || this.inputElement.val();
			
			if (this.opts.delim !== undefined && this.opts.delim != '') {
			 	value = (value.match(new RegExp('(^|'+this.opts.delim+' *)([^'+this.opts.delim+']*)$')) || ['', '', '']);
			 	value = value[2];
			 }
			 
			return value;
		}
		
		/**
			@private
			@name glow.widgets.AutoSuggest#suggest
			@param {string} suggested The text that is being suggested.
			@description Display text with the suggested portion selected.
		 */
		glow.widgets.AutoSuggest.prototype.suggest = function(suggested) { /*debug*///console.log("suggest("+suggested+")");
			this._suggested = suggested;
			var currentValue = this.inputElement.val();
			var delim = (this.opts.delim || '');
			var value = appendTag(currentValue, delim, suggested);
			this.inputElement.val(value);

			if (this.opts.selectCompletedText) {
				selectRange(this.inputElement[0], {start: (this._value || '').length, end: this.inputElement.val().length}); //currentValue.length+suggested.length})
			}
		}
		
		/**
			@private
			@description Make the text in the given range selected.
			@param el
			@param range
			@param range.start
			@param range.end
		 */
		function selectRange(el, range) { /*debug*///console.log("selectRange("+el+", "+range.toSource()+")");
			el.focus();

			if (!window.opera && el.createTextRange) { // ie, but not opera (faker)
				var r = el.createTextRange();
				r.moveEnd('character', range.end);
				r.moveStart('character', range.start);
				r.select();
			}
   			else { // moz, saf, opera
   				el.select();
				el.selectionStart = range.start;
				el.selectionEnd = range.end;
			}
		}
		
		/**
			@private
		 */
		function setCaretTo(el, pos) { /*debug*///console.log("setCaretTo("+el+", "+pos+")");
			selectRange(el, {start: pos, end: pos})
		}
		
		/**
		  @private
		  @name array_indexOf
		  @function
		  @description Find the position of a value in an array. Like Mozilla's
		  Array#indexOf().
		 */
		function array_indexOf(value) {
			var index = -1;
		
			for (var i = 0, l = this.length; i < l; i++) {
				if (this[i] === value) {
					index = i;
					break;
				}
			}
		
			return index;
		}

		/**
		  @private
		  @name glow.widgets.AutoSuggest#find
		  @function
		  @description Cause the data to be searched for items that match the value of the inputElement.
		  @param {String} lookFor For testing purposes you can pass in a lookFor, otherwise it will be drawn from the inputElement.
		  @returns undefined
		 */
		glow.widgets.AutoSuggest.prototype.find = function(lookFor) { /*debug*///console.log("find()")
			if (lookFor === undefined) lookFor = this.getValue();
			
			// ltrim
			while (lookFor.charAt(0) == ' ') lookFor = lookFor.substring(1);

			if (!this.opts.caseSensitive) lookFor = lookFor.toLowerCase();

			var found = [];
			found.indexOf || (found.indexOf = array_indexOf);

			if (lookFor) {
				for (var k in this.index) {
					var lookAt = k.substring(1);

					if (this._isMatch(lookAt, lookFor)) {
						var keys = this.index[k];						
						
						for (var j = 0; j < keys.length; j++) {
							var offset = keys[j];
							
							if (found.indexOf(this.results[offset]) == -1) {
								found.push(this.results[offset]);
							}
						}
					}
				}
			}
			
			// apply any optional filtyering to the results
			found = this._filter(found);
			
			this._found = found; // used to get the selected object in event handlers
			if (found.length) {
				if (this.opts.maxListLength) found.length = Math.min(found.length, this.opts.maxListLength);
				
				var list = [];
				for (var i = 0; i < found.length; i++) {
					list.push('<li class="'+((i%2)? 'odd' : 'even')+'">'+this._formatItem(found[i])+'</li>');	
				}
				$(this.overlay.container.get('ul')[0]).html(list.join(''));
				
				this.show();
				
				if (this.opts.activeOnShow !== false) nextItem(this);
			}
			else {
				this.hide();
			}
		}
		
		/**
			@private
			@description Make the overlay not visible.
		 */
		glow.widgets.AutoSuggest.prototype.hide = function() { /*debug*///console.log("hide()")
			this.overlay.hide();
		}
		
		/**
			@private
			@description Make the overlay visible.
		 */
		glow.widgets.AutoSuggest.prototype.show = function() { /*debug*///console.log("show()")
			this._original = this.val();
			place(this);
			this.overlay.show();
		}
		
		/**
			@private
			@description Get the offset of the currently selected item in the results.
		 */
		glow.widgets.AutoSuggest.prototype.getSelectedOffset = function() {
			if (!isVisible(this)) return -1;
			
			var items = this.overlay.container.get('li'); // TODO: handle embedded list items
			
			for (var i = 0; i < items.length; i++) {
				if ($(items[i]).hasClass('active')) return i;
			}
			
			return -1;
		}
	}
});
(window.gloader || glow).module({
	name: 'glow.widgets.AutoComplete',
	library: ['glow', '1.7.0'],
	depends: [[
		'glow', '1.7.0',
		'glow.widgets.AutoSuggest'
	]],
	
	builder: function(glow) {
/* private fields *************************************************************/
		var $      = glow.dom.get, // shortcuts
			events = glow.events,
			anim   = glow.anim;
			
/* private functions **********************************************************/
/* constructor ****************************************************************/
		/**
			@constructor
			@name glow.widgets.AutoComplete
			@see <a href="../furtherinfo/widgets/autosuggest/">AutoSuggest user guide</a>
			@deprecated Since version 1.2.2. You should now use glow.widgets.AutoSuggest with the 'complete' constructor option
			@description Adds the ability to complete what has been typed to the AutoSuggest widget.
			
			This widget acts as a thin wrapper to the {@link glow.widgets.AutoSuggest}
			widget and adds the ability to automatically append the missing text
			to complete what has been typed by the user. Note that because the
			completed item must be text in order to appear in the input element,
			this widget can only process data items that are strings.
			@param {NodeList | String} inputElement
				 A NodeList or css selector that points to a text input element.
			@param {Object[] | String | Function} dataSource Either a dataSource
				 object, a function that returns a dataSource object or a URL that
				 returns a dataSource object.
			@param {Object} opts All options are passed directly to the wrapped instance of
			{@link glow.widgets.AutoSuggest}.
			@param {string} opts.delim Character to delimit multiple entries.
			  If defined, the user can enter more than one term into the text input 
			  element, delimited by this string (and any spaces surrounding the delimiter).
		 */
		glow.widgets.AutoComplete = function(inputElement, dataSource, opts) { /*debug*///console.log('new glow.widgets.AutoComplete('+inputElement+', '+dataSource+', '+opts+')');
			opts = opts || {};
			
			/**
				@object
				@name glow.widgets.AutoComplete#autosuggest
				@type glow.widgets.AutoSuggest
				@description The wrapped instance of glow.widgets.AutoSuggest used to implement this widget.
			*/
			this.autosuggest = new glow.widgets.AutoSuggest(inputElement, [], opts);
			this.autosuggest._indexer = function(dataItem) { return dataItem.toString(); }
			this.autosuggest._formatItem = function(dataItem) { return dataItem.toString(); }
			this.autosuggest.setData(dataSource);
			
			var that = this.autosuggest;
			
			events.addListener(
				that,
				'itemActive',
				function(e) {
					var selectedOffset = that.getSelectedOffset();
					if (selectedOffset == -1) return false;
					that.suggest(that._found[selectedOffset]);
					
					return true;
				}
			);
		}

/* public fields **************************************************************/	
/* public methods *************************************************************/
	}
});
(window.gloader || glow).module({
	name: "glow.widgets.Carousel",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		"glow.dom",
		"glow.events",
		"glow.anim",
		"glow.widgets",
		'glow.i18n'
	]],
	builder: function(glow) {
		var $      = glow.dom.get,
		    events = glow.events,
		       dom = glow.dom,
   			$i18n  = glow.i18n;
		
		$i18n.addLocaleModule("GLOW_WIDGETS_CAROUSEL", "en", {
			PREVIOUS : "previous",
			NEXT : "next"
		});
		
		/**
			@name glow.widgets.Carousel
			@class
			@description Scroll through a list of items

			<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
	
			@param {glow.dom.NodeList} container The container of items to display as a carousel.
			@param {Object} opts Options object
				@param {Boolean} [opts.loop=false] True if the carousel should loop when it gets to the end.
					When using the loop option, it is good practice to indicate to the user how far they have scrolled through the carousel.  We recommend the use of the pageNav parameter when allowing the user the loop to the begining of the carousel.
				@param {Number} [opts.animDuration=0.2] Duration of animation in seconds.
				@param {Function} [opts.animTween=glow.tweens.easeBoth()] A Glow tween function to animate scrolling.
				@param {Number|String} [opts.step=1] Number of items to scroll by. When the string 'page' is passed in the carousel will be set to scroll by the number of viewable items.
				@param {Function} [opts.onAddItem] Event shortcut.
				{@link glow.widgets.Carousel.AddItem See documentation below}
				@param {Function} [opts.onRemoveItem] Event shortcut.
				{@link glow.widgets.Carousel.RemoveItem See documentation below}
				@param {Function} [opts.onScroll] Event shortcut.
				{@link glow.widgets.Carousel.onScroll See documentation below}
				@param {Function} [opts.onAddItem] Event shortcut.
				{@link glow.widgets.Carousel.AddItem See documentation below}
				@param {Function} [opts.onAfterScroll] Event shortcut.
				{@link glow.widgets.Carousel.AfterScroll See documentation below}
				@param {Function} [opts.onItemClick] Event shortcut.
				{@link glow.widgets.Carousel.ItemClick See documentation below}
				@param {Boolean} [opts.vertical=false] Used to create a vertical oriented carousel
				@param {Number} [opts.size] Number of items the carousel displays at any one time
					By default, the carousel will fill all available horizontal (or vertical) space.
				@param {Boolean} [opts.scrollOnHold=true] Continue to scroll while button is held down.
				@param {Boolean} [opts.slideOnScroll=false] Use sliding animation when scrolling continuously.
				@param {String} [opts.theme="light"] Visual Theme
					Only applies when using the default template.  Currently supported themes are "dark" and "light".
				@param {Boolean} [opts.pageNav=false] Display navigational control next to the carousel.
				@param {String} [opts.id] An ID to apply to the container element.
				@param {String} [opts.className] List of additional space separated class names to apply to the container.
					Space separated values.
	
			@example
				var myCarousel = new glow.widgets.Carousel("#carouselContainer", {
					loop: true,
					size: 4,
					step: 4
				});
	
			@see <a href="../furtherinfo/widgets/carousel/">Carousel user guide</a>
		*/
		/**
			@name glow.widgets.Carousel#event:addItem
			@event
			@description One or more items about to be added to the carousel.
		
					Canceling this event stops the items being added.
			
			@param {glow.events.Event} event Event Object
			@param {glow.dom.NodeList} event.items NodeList of items being added
		*/
		/**
			@name glow.widgets.Carousel#event:removeItem
			@event
			@description Item about to be removed.

				Canceling this event results in the item not being removed.
			
			@param {glow.events.Event} event Event Object
			@param {glow.dom.NodeList} event.item Represents the item to be removed
			@param {Number} event.itemIndex Index of the item to be removed
		*/
		/**
			@name glow.widgets.Carousel#event:scroll
			@event
			@description Fired before scrolling.
			
			@param {glow.events.Event} event Event Object
			@param {Number} event.currentPosition Carousel's current position
		*/
		/**
			@name glow.widgets.Carousel#event:afterScroll
			@event
			@description Fired after scrolling animation is complete.
			
			@param {glow.events.Event} event Event Object
			@param {Number} event.position The carousel's new position
		*/
		/**
			@name glow.widgets.Carousel#event:itemClick
			@event
			@description Fired when an item within the carousel is clicked.

				The event contains properties 'item' an html element
				representing the clicked item, and 'itemIndex', the index of the item
				clicked.
			
			@param {glow.events.Event} event Event Object
			@param {glow.dom.NodeList} event.item Represents the item clicked
			@param {Number} event.itemIndex Index of the item clicked
			
		*/

		/* Public Properties */

		/**
			@name glow.widgets.Carousel#element
			@type glow.dom.NodeList
			@description Carousel HTML Element.
			@example
				var myCarousel = new glow.widgets.Carousel("#carouselContainer");
				glow.events.addListener(myCarousel, "itemClick", function(e) {
					alert(this.element) // returns the HTML element "#carouselContainer"
				});
		*/

		/**
			@name glow.widgets.Carousel#items
			@type glow.dom.NodeList
			@description NodeList of the items within the carousel.
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer");
				glow.events.addListener(myCarousel, "itemClick", function(e) {
					alert(this.items) // returns an array of &lt;li /&gt; elements in "ul#carouselContainer"
				});
		*/
		function Carousel(container, opts) {
			var localeModule = $i18n.getLocaleModule("GLOW_WIDGETS_CAROUSEL");
						
			opts = opts || {}; // prevent errors when trying to read properties of undefined opts
			
			// create carousel content
			this._content = $(container);
			
			this._startContentHeight = this._content[0].offsetHeight;

			this._content.addClass("carousel-content") // add a css selector hook 
				.css("zoom", "1"); // hack: adds "haslayout" on ie
			
			this.items = this._content.children();
			
			// set option defaults
			opts = this._opts = glow.lang.apply(
				{
					animDuration: 0.4,
					animTween: glow.tweens.easeBoth(),
					loop: false,
					step: 1,
					vertical: false,
					scrollOnHold: true,
					slideOnScroll: false,
					theme: "light",
					pageNav: false
				},
				opts
			);
			
			// cast the integers
			opts.animDuration = Number(opts.animDuration);
			opts.size = Number(opts.size);
			

			// build HTML
			this.element =
				dom.create("<div"
					+ (this._opts.id? " id=\"" + this._opts.id + "\"" : "")
					+ " class=\"" + (this._opts.vertical? "glow170-vCarousel" : "glow170-carousel")
					+ (this._opts.className? " " + this._opts.className : "")
					+ "\"></div>"
				);
			var themeWrapper = dom.create("<div class=\"carousel-"+this._opts.theme+"\"><\/div>");
			this._viewWindow = dom.create("<div class=\"carousel-window\"><\/div>");
						
			// move the carousel items into the carousel view window, themewrapper, and carousel content
			this._content.before(this.element);
			themeWrapper.prependTo(this.element);
			this._viewWindow.prependTo(themeWrapper);
			this._content.prependTo(this._viewWindow);
			
			// add selector hooks
			if (this._opts.vertical) {
				this.element.addClass("glow170-vCarousel");
			}
			else {
				this.element.addClass("glow170-carousel");
			}
			
			// create the navigational buttons
			if (!this._opts.pageNav) {
				this._navPrev = dom.create("<a class=\"carousel-nav carousel-prev\" href=\"#\"><span class=\"carousel-label\">{PREVIOUS}</span><span class=\"carousel-background\"></span><span class=\"carousel-top\"></span><span class=\"carousel-bottom\"></span><span class=\"carousel-arrow\"></span></a>", {interpolate: localeModule}).insertBefore(this._viewWindow);
				this._navNext = dom.create("<a class=\"carousel-nav carousel-next\" href=\"#\"><span class=\"carousel-label\">{NEXT}</span><span class=\"carousel-background\"></span><span class=\"carousel-top\"></span><span class=\"carousel-bottom\"></span><span class=\"carousel-arrow\"></span></a>", {interpolate: localeModule}).insertAfter(this._viewWindow);
			}
			
			init.apply(this, [container, opts]);
		}
		
		/**
			Runs only once, during construction phase.
			@private
		 */
		function init(container, opts) {
			var that = this; // used in callbacks to refer to myself
			
			if (this.items.length == 0) { return; }
			// calculate the view size if it isn't given, and size the view window
			// we absolutely position the item for a moment so it shrinks to fit
			var oldPositionVal = this.items[0].style.position;
			this.items[0].style.position = "absolute";
			this._itemWidth  = this.items[0].offsetWidth  + parseInt( $(this.items[0]).css(["margin-left", "margin-right"]) );
			this._itemHeight = this.items[0].offsetHeight + parseInt( $(this.items[0]).css(["margin-top", "margin-bottom"]) );
			this.items[0].style.position = oldPositionVal;
			// Is there a fraction of an item hanging off the end of the carousel?
			// This can only happen if opts.size is false
			this._itemHangingOffEnd = false;
			if (!opts.size) { // you really should just give me the size, don't you think? yes, I know it's optional but is that really too much to ask for considering everything? really?
				var itemsInView;
				
				if (opts.vertical) {
					
					this._sizeView = this._startContentHeight;
					if (!this._opts.pageNav) this._sizeView -= this._navPrev[0].offsetHeight + this._navNext[0].offsetHeight;
					
					this._viewWindow.css("width", this._itemWidth + "px");
					this._viewWindow.css("height", this._sizeView + "px");
					
					itemsInView = this._sizeView / this._itemHeight;
					this._opts.size = Math.floor(itemsInView);
					// do we have an item hanging off the end?
					this._itemHangingOffEnd = (itemsInView != this._opts.size);
					
					// now fix the size to prevent wrapping if the browser is resized
					this.element.css("height", this._sizeView + (this._opts.pageNav? 0 : this._navPrev[0].offsetHeight + this._navNext[0].offsetHeight) + "px");
				}
				else {
					this._sizeView = this.element[0].offsetWidth;
					if (!this._opts.pageNav) this._sizeView -= this._navPrev[0].offsetWidth + this._navNext[0].offsetWidth;

					this._viewWindow.css("width", this._sizeView + "px");
					this._viewWindow.css("height", this._itemHeight + "px");
					
					itemsInView = this._sizeView / this._itemWidth;
					this._opts.size = Math.floor(itemsInView);
					// do we have an item hanging off the end?
					this._itemHangingOffEnd = (itemsInView != this._opts.size);
					
					
					this.element.css("width", this._sizeView + (this._opts.pageNav? 0 : this._navPrev[0].offsetWidth + this._navNext[0].offsetWidth) + "px");
				}
			}
			else {
				if (this._opts.vertical) {
					this._viewWindow.css("width", this._itemWidth + "px");
					this._viewWindow.css("height", this._opts.size * this._itemHeight + "px");
				}
				else {
					this._viewWindow.css("width", this._opts.size * this._itemWidth + "px");
					this._viewWindow.css("height", this._itemHeight + "px");
				}
			}

			// Change for trac 151
			// If step set to page then set the carousel to step through the items by the number of viewable items
			if (this._opts.step == "page")
			{
				this._opts.step = this._opts.size;
			}

			// check that options are sane
			if (this._opts.size < this._opts.step) {
				throw new Error("Carousel opts.step ("+this._opts.step+") cannot be larger than carousel size ("+this._opts.size+").");
			}
			
			// install listeners for optional event handlers
			var eventNames = ["addItem","removeItem","scroll","afterScroll","itemClick"],
				i = eventNames.length,
				onEventName;
			while(i--) {
				// convert names from event to onEvent
				onEventName = "on" + eventNames[i].charAt(0).toUpperCase() + eventNames[i].slice(1);
				if (opts[onEventName]) {
					events.addListener(that,eventNames[i],opts[onEventName]);
				}
			}
			
			// have the nav items already got a width / height set on the style attribute?
			this._customButtonDimentions = (this._navPrev && this._navNext) && (
				this._navPrev[0].style.width
				|| this._navPrev[0].style.height
				|| this._navNext[0].style.width
				|| this._navNext[0].style.height
			);
			
			this._originalOptsLoop = this._opts.loop; // Added for bug fix trac 152 ***

			rebuild.apply(this);
			
			// apply events
			addMouseNavEvents.call(this);
			addKeyboardNavEvents.call(this);
			addItemClickEvent.call(this);
			
			this._ready = true;
		}
		
		/**
			Deal with delegation for the itemClick event
			@private
		*/
		function addItemClickEvent() {
			// set up item events
			var that = this;
			
			glow.events.addListener(that._content, "click", function(e) { /*debug*///console.log("item clicked "+e.source);
				var el = $(e.source),
					event;
				
				for (; el[0] != that.element[0]; el = el.parent()) { // climb up the dom tree
					if (el.hasClass("carousel-item")) {
						if (!el.hasClass("carousel-pad")) {
							event = glow.events.fire(that, "itemClick", {
								item: el[0],
								itemIndex: el[0]["_index"+glow.UID] % that._countReal
							});
							return !event.defaultPrevented();
						}
						break;
					}
				}
			});
		}
		
		// add events for mouse navigation
		function addMouseNavEvents() {
			var that = this,
				bothNavElms = $(this._navPrev).push(this._navNext);
				
			// add navigational events
			events.addListener(bothNavElms, "click", function(e) {
				return false;
			});
			events.addListener(bothNavElms, "mouseup", function(e) {
				stopRepeatOrSlide.call(that);
				return false;
			});
			events.addListener(bothNavElms, "mouseleave",  function(e){
				stopRepeatOrSlide.call(that);
			});
			events.addListener(this._navPrev, "mousedown", function(e) {
				that.prev();
				startRepeatOrSlide.call(that, true);
				return false;
			});
			events.addListener(this._navNext, "mousedown", function(e){
				that.next();
				startRepeatOrSlide.call(that);
				return false;
			});
		}
		
		/**
			Add the events needed for keboard navigation
			@private
		*/
		function addKeyboardNavEvents() {
			// keyboard nav
			var currentKeyDown,
				that = this;
				
			events.addListener(this.element, "keydown", function(e) {
				if (currentKeyDown) {
					return false;
				}
				switch (e.key) {
					case "UP":
					case "LEFT":
						currentKeyDown = e.key
						if ( !that._isPlaying() ) {
							that.prev();
							startRepeatOrSlide.call(that, true);
						}
						return false;
					case "DOWN":
					case "RIGHT":
						currentKeyDown = e.key
						if ( !that._isPlaying() ) {
							that.next();
							startRepeatOrSlide.call(that);
						}
						return false;
					case "ENTER":
						currentKeyDown = e.key
						if ( e.source == that._navNext[0] || (that._pageNav && e.source.parentNode == that._pageNav.rightarrow[0]) ) {
							that.next();
							startRepeatOrSlide.call(that);
							return false;
						} else if (e.source == that._navPrev[0] || (that._pageNav && e.source.parentNode == that._pageNav.leftarrow[0]) ) {
							that.prev();
							startRepeatOrSlide.call(that, true);
							return false;
						}
				}
				
			});
			events.addListener(this.element, "keyup", function(e) {
				switch (e.key) {
					case "UP":
					case "LEFT":
					case "DOWN":
					case "RIGHT":
					case "ENTER":
						currentKeyDown = null;
						stopRepeatOrSlide.call(that);
				}
			});
			// prevent scrolling in opera
			events.addListener(this.element, "keypress", function(e) {
				switch (e.key) {
					case "UP":
					case "LEFT":
					case "DOWN":
					case "RIGHT":
						return false;
					case "ENTER":
						if (
							e.source == that._navNext[0] || (that._pageNav && e.source.parentNode == that._pageNav.rightarrow[0]) ||
							e.source == that._navPrev[0] || (that._pageNav && e.source.parentNode == that._pageNav.leftarrow[0])
						) {
							return false;
						}
				}
			});
			
			// capture focus on the element to catch tabbing
			glow.events.addListener(this.element, "focus", function(e) {
				_focusCallback.call( that, $(e.source) );
			});
		}
		
		// called when the carousel gets focus
		// elm - NodeList of the element which got focus (event source)
		function _focusCallback(elm) {
			var that = this;
			// If the element is not one of the nav buttons (and is not in the pageNav) ...
			if (
				   (elm[0] != this._navNext[0])
				&& (elm[0] != this._navPrev[0])
				&& (elm.parent().parent().hasClass('pageNav') == false)
			) {
				// Get the element's index number from it's parent
				var elmItemNum = _getCarouselItemNum.call(this, elm);
				// return if elmItemNum is -1 (item not found) or item is a clone
				if (elmItemNum === -1 || this.items.slice(elmItemNum, elmItemNum+1).hasClass('carousel-added')) {
					return;
				}
				// And Check to see if the index number is in the array of visible indexes...
				if ( (' ' + this.visibleIndexes().join(' ') + ' ').indexOf(' ' + elmItemNum + ' ') == -1 ) {
					// If so, then move the carousel to that index
					this.moveTo(elmItemNum);
					setTimeout(function() {
						that._content[0].parentNode.scrollLeft = 0;
					}, 0);
				}
			}
		}
		
		// Work out the index number of the element within the carousel
		// elm - NodeList of element in carousel. can be the containing item, or decendant of the containing item
		function _getCarouselItemNum(elm) {
			// Recurse back through parents until we find the carousel item
			while ( !elm.hasClass('carousel-item') ) {
				if ( elm.length == 0 ) {
					// an item doesn't have focus
					return -1;
				}
				elm = elm.parent();
			}
			
			// Create nodeList of passed in element's siblings
			var elmSiblings = elm.parent().children();

			// Default return value is -1, we'll update this if we find a match (we should always find a match so this value is redundant)
			var x = -1;

			// Loop through sibling nodes until we find a match with the original element
			elmSiblings.each(function(i){
				// When we get a match set the value of x to match the index value
				if (elmSiblings[i] == elm[0]) {
					x = i;
				}
			});

			return x;
		}
		
		/**
			Runs during construction phase and whenever items are added or removed.
			@private
		 */
		function rebuild() { /*debug*///console.log("Carousel-rebuild()");
			var that = this; // used in callbacks to refer to myself
    
			this.items = this._content.children();
			var padCount;

			// Bug fix for trac 152 ***
			// Will the content fill the view?
			this._notEnoughContent = this.items.length <= this._opts.size;
			if (this._notEnoughContent)
			{
				// If not then stop any looping and add CSS hook
				this._opts.loop = false;
				this.element.get(".carousel-window").addClass("carousel-notEnoughItems");
			} else {
				//
				this._opts.loop = this._originalOptsLoop;
				this.element.get(".carousel-window").removeClass("carousel-notEnoughItems");
				if (this._navPrev)
				{
					this._navPrev.removeClass("carousel-prev-disabled");
					this._navNext.removeClass("carousel-next-disabled");
				}
			}


			// the number of pads needed differs if we're looping or not
			if (this._opts.loop) {
				// pad items to an even step, prevents carousel getting out of step
				// if the modulus is zero, we deduct the step to make the padCount zero
				padCount = this._opts.step - ((this.items.length % this._opts.step) || this._opts.step);
			} else {
				// first, how many 'next's does it take to see all the items
				var stepsTillEndOfContent = Math.ceil((this.items.length - this._opts.size) / this._opts.step);
				padCount = (this._opts.size + (stepsTillEndOfContent * this._opts.step)) - this.items.length;
				// we need an extra pad if there's an item hanging off the end
				padCount += Number(this._itemHangingOffEnd);
			}
			// use the first item as a model for our pads
			var pad = $(this.items[0]).clone().attr('role', 'presentation'); // hide the padding item from screenreaders
			pad.attr('tabIndex', '-1');
			pad.get('a, img, input').attr('tabIndex', '-1');
			pad.removeAttr("id");
			pad.addClass("carousel-added");
			pad.addClass("carousel-pad");
			/*debug*///pad.html("PAD");
			pad.children().css("visibility", "hidden"); // keep the same dimensions as the model, but don't display anything
				
			for (var i = 0; i < padCount; i++) {
				this._content.append(pad.clone());
			}
			this.items = this._content.children();
			var realCount = this.items.length;
			// grow items by adding clones, allows for wrapping to work
			if (this._opts.loop) {
				// We need an extra clone if there's an item hanging off the end
				var clonesToAdd = this._opts.size + Number(this._itemHangingOffEnd);
				var clone = this.items.slice(0, clonesToAdd).clone(true).attr('role', 'presentation');
				/*debug*///clone.attr("style", "float:left;filter:alpha(opacity=40);opacity:.4;");
				clone.attr('tabIndex', '-1');
				clone.get('a, img, input').attr('tabIndex', '-1');
				clone.addClass("carousel-added");
				this._content.append(clone);
				this.items = this._content.children();
			}
			
			// add css selector hooks
			this.items.addClass("carousel-item"); // add css selector hook
			this.items.each(function(i){ this["_index"+glow.UID] = i; }); // items know their index

			// some private variables
			this._direction = (this._opts.vertical)? "top" : "left";
			this._countRealItems = realCount - padCount;
			this._countReal  = realCount; // includes pads, but not clones
			this._countAll   = this.items.length;
			this._countStep  = this._opts.step;
			this._countView  = this._opts.size;
			this._sizeEach = (this._opts.vertical? this._itemHeight : this._itemWidth);
			this._sizeStep = this._sizeEach * this._opts.step;
			this._sizeView = this._sizeEach * this._opts.size;
			this._sizeReal = this._sizeEach * this._countReal;
			this._sizeAll  = this._sizeEach * this._countAll;
			this._animationTime  = this._opts.animDuration;
			// sliding animations take less time
			this._slideAnimationTime = this._animationTime / 2;
			this._animationTween = this._opts.animTween;
			
			// size the content 
			(this._opts.vertical)? this._content.css("height", this._sizeAll+"px") : this._content.css("width", this._sizeAll+"px");
			
			// position navigation buttons
			if (!this._opts.pageNav && !this._customButtonDimentions) {
				if (this._opts.vertical) {
					this._navPrev.width(parseInt(this.items[0].offsetWidth)+ parseInt($(this.items[0]).css(["margin-left", "margin-right"])));
					this._navNext.width(parseInt(this.items[0].offsetWidth)+ parseInt($(this.items[0]).css(["margin-left", "margin-right"])));
				}
				else {
					this._navPrev.height(parseInt(this.items[0].offsetHeight)+ parseInt($(this.items[0]).css(["margin-top", "margin-bottom"])));
					this._navNext.height(parseInt(this.items[0].offsetHeight)+ parseInt($(this.items[0]).css(["margin-top", "margin-bottom"])));
				}
			}
			
			//// build sliding timelines
				var channelPrev = [];
				var channelNext = [];	
				var slideMove, slideAnim;
				
				function animComplete() {
					afterScroll.apply(that);
				}
				
				// from the start, how many moves can the carousel make before looping to start or running out of items
				if (this._opts.loop) {
					this._movesMax = (this._countReal / this._countStep) - 1;
				}
				else {
					// we use _itemHangingOffEnd to ignore a padded item at the end which is only half in view
					this._movesMax = Math.ceil( ( this._countReal - this._countView - Number(this._itemHangingOffEnd) ) / this._countStep );
				}
				
				// we animate for one more step than _movesMax if we're looping, because we need to loop back to the first set of items (ie, the clones)
				var len = this._movesMax + Number(this._opts.loop);
				for (var i = 0; i < len; i++) {
					slideMove = {};
					slideMove["margin-" + this._direction] = {
						from: (-i * this._sizeStep)+"px",
						to:   (-(i+1) * this._sizeStep)+"px"
					};
	
					slideAnim = glow.anim.css(this._content, this._slideAnimationTime, slideMove, { "tween": glow.tweens.linear() })
					events.addListener(slideAnim, "complete", animComplete);
				
					channelNext.push(slideAnim);
					
					slideMove = {};				
					slideMove["margin-" + this._direction] = {
						from:   (-(i+1) * this._sizeStep)+"px",
						to: (-i * this._sizeStep)+"px"
					};
	
					slideAnim = glow.anim.css(this._content, this._slideAnimationTime, slideMove, { "tween": glow.tweens.linear() })
					events.addListener(slideAnim, "complete", animComplete);
	
					channelPrev.unshift(slideAnim); // note diff in Next, Prev: push versus unshift
				}
				
				this._slidePrev = new glow.anim.Timeline(channelPrev, {loop: this._opts.loop});
				this._slideNext = new glow.anim.Timeline(channelNext, {loop: this._opts.loop});
			////
			
			// initialise the "dots", if they are needed
			if (this._opts.pageNav) {
				this._pageNav = new PageNav(
					this._movesMax + 1,
					function(newPage) {
						that.moveTo(newPage * that._countStep);
					}
				);
				
				// replace the default nav buttons with some from the pageNav
				this._navPrev = this._pageNav.leftarrow;
				this._navNext = this._pageNav.rightarrow;
				
				var carouselWindow = this.element.get(".carousel-window");
				// remove any existing pageNav
				carouselWindow.parent().get(".pageNav").remove()
				this._pageNav.element.insertAfter(carouselWindow);
				carouselWindow.addClass("paged");
				
				// position pageNav so it is centered with carousel window
				if (this._opts.vertical) {
					var topmargin = Math.floor(((carouselWindow[0].offsetHeight) - this._pageNav.element[0].offsetHeight) / 2);
					this._pageNav.element.css("margin-top", topmargin+"px");
				}
				else {
					// assumes width of pageNav list == sum of width of all list items
					var leftmargin = Math.floor(((carouselWindow[0].offsetWidth) - this._pageNav.leftarrow[0].offsetWidth*(3+this._movesMax)) / 2);
					this._pageNav.element.css("margin-left", leftmargin+"px");
				}
				this._pageNav.update( (this._visibleIndexFirst() % this._countReal) / this._countStep );
			}
			
			// set initial disabled-states of the navigation buttons
			if (this._notEnoughContent) { 
				// Added for bug fix trac 152 ***
				// If there isn't enough content to require scrolling then disable both buttons
				if (this._navPrev) {
					this._navPrev.addClass("carousel-prev-disabled");
					this._navNext.addClass("carousel-next-disabled");
				}
			} else if (!this._opts.loop) {
				if (!canGo.apply(this, ["prev"])) this._navPrev.addClass("carousel-prev-disabled");
				else if (!canGo.apply(this, [])) this._navNext.addClass("carousel-next-disabled");
			}
			// need to add back the navigation events on arrows if pageNav is true
			if (this._opts.pageNav) {		    
			    addMouseNavEvents.call(this);
			}

		}
		
		/**
			Move the carousel by one step.
			@private
			@param {Boolean} prev True if moving prevward, otherwise moving nextward.
		 */
		function step(prev) { /*debug*///console.log("step("+prev+")");
			if ( this._isPlaying() || !canGo.call(this, prev) ) return;
			var curMargin = parseInt(this._content.css("margin-" + this._direction)) % this._sizeReal;
			
			if (prev && curMargin == 0) curMargin -= this._sizeReal;
			var newMargin = curMargin - ((prev? -1 : +1 ) * this._sizeStep);
			
			var move = {};
			move["margin-" + this._direction] = {
				from: curMargin,
				to: newMargin
			};
			
			this._step = glow.anim.css(this._content, this._animationTime, move, {
				"tween": this._animationTween
			});
			
			this._step.start();
			var that = this;
			
			glow.events.addListener(this._step, "complete", function() {
				afterScroll.apply(that);
			});
		}
		
		/**
			Start the carousel repeating / sliding
			@private
			@param {Boolean} prev True if moving prevward, otherwise moving nextward.
		 */
		function startRepeatOrSlide(prev) {
			// if either of the timelines are currently playing, exit
			if ( this._slidePrev.isPlaying() || this._slideNext.isPlaying() ) {
				return;
			}
			
			var that = this;
			this._repeat = true;
			
			// either repeat stepping, or start sliding...
			function beginRepeatOrSlide() {
				if (that._opts.slideOnScroll) {
					if (canGo.apply(that, [prev])) {
						var timeOffset = getTimeoffset.apply(that);
						// transpose timeoffset for previous direction
						if (prev) timeOffset = that._slidePrev.duration - timeOffset;
						// pause a little then start sliding
						var timelineToUse = prev ? that._slidePrev : that._slideNext;
						setTimeout( function() {
							if ( that._isPlaying() || !that._repeat ) return;
							timelineToUse.goTo(timeOffset).resume();
						}, 300);
					}
				}
				else {
					if ( !that._repeat ) return;
					step.call(that, prev);
					if (that._step) {
						glow.events.addListener(that._step, "complete", beginRepeatOrSlide);
					}
				}
			}
			
			if (this._opts.scrollOnHold) {
				// if there's currently a step in action (there usually is) we need to wait for it
				if ( this._step && this._step.isPlaying() ) {
					// we set a property on the step to ensure we only set the listener once
					if (!this._step._hasSlidingListener) {
						glow.events.addListener(this._step, "complete", beginRepeatOrSlide);
						this._step._hasSlidingListener = true;
					}
				} else {
					beginRepeatOrSlide();
				}
			}
		}
		
		/**
			Stop the carousel repeating / sliding at the next appropiate moment
			@private
		 */
		function stopRepeatOrSlide() {
			this._repeat = false;
		}
		
		/**
			Is it possible to go one step in the given direction or not?
			@private
			@param {Boolean} prev True if moving prevward, otherwise moving nextward.
			@returns {Boolean}
		 */
		function canGo(prev) { /*debug*///console.log("canGo("+prev+")");
			if (this._opts.loop) return true;
			
			// prevent wrapping on non-looping carousels
			var firstIndex = this._visibleIndexFirst();
			if (prev) {
				return firstIndex != 0;
			}
			// ok, we're seeing if we can travel forward...
			// if there's an item hanging off the end we need to pretend it doesn't exist (it'll always be a padded item, so it's ok)
			return (firstIndex + this._countView) < (this._countAll - Number(this._itemHangingOffEnd));
		}
		
		/**
			Runs before the carousel moves.
			@private
		 */
		function beforeScroll() { /*debug*///console.log("Carousel-beforeScroll()");

			this._navPrev.removeClass("carousel-prev-disabled");
			this._navNext.removeClass("carousel-next-disabled");

			events.fire(this, "scroll", {
				currentPosition: this._visibleIndexFirst() % this._countReal
			});
		}
		
		/**
			Runs after the carousel moves.
			@private
		 */
		function afterScroll() { /*debug*///console.log("Carousel-afterScroll()");
			
			if ( !this._repeat || !this._opts.scrollOnHold ) {
				endScroll.apply(this);
			}
			
			var curItem = this._visibleIndexFirst();
			
			events.fire(this, "afterScroll", {
				position: curItem % this._countReal
			});
			
			if (this._pageNav) {
				this._pageNav.update((curItem % this._countReal) / this._countStep);
			}
			
			if (!this._opts.loop) {
				if (!canGo.apply(this, ["prev"])) this._navPrev.addClass("carousel-prev-disabled");
				else if (!canGo.apply(this, [])) this._navNext.addClass("carousel-next-disabled");
			}
		}
		
		// triggered when scrolling ends
		function endScroll() { /*debug*///console.log("Carousel-endScroll()");
			// stop any currently playing animations
			this._slideNext.stop();
			this._slidePrev.stop();
		}
		
		/**
			@name glow.widgets.Carousel#prev
			@function
			@description Scroll backwards by the number of items defined by step in the constructor.
		*/
		Carousel.prototype.prev = function() { /*debug*///console.log("Carousel#prev()");
			if (!this._isPlaying()) {
				if (!canGo.apply(this, ["prev"])) return this;
				beforeScroll.apply(this, ["prev"]);
				step.apply(this, ["prev"]);
			}
			return this;
		}
		
		/**
			@name glow.widgets.Carousel#next
			@function
			@description Scroll forward by the number of items definded by step in the constructor.
		*/
		Carousel.prototype.next = function() { /*debug*///console.log("Carousel#next()");			
			if (!this._isPlaying()) {
				if (!canGo.apply(this, [])) return this;
				beforeScroll.apply(this, []);
				step.apply(this, []);
			}
			return this;
		}
		
		/**
			Calculate what the time offset of a slide would be.
			
			This is necessary because Timelines are indexed by time.
			@private
			@returns {Number}
		 */
		function getTimeoffset() { /*debug*///console.log("getTimeoffset()");
			var margin = parseInt(this._content.css("margin-" + this._direction));
			var stepOffset = Math.abs(margin)/this._sizeStep;
			var timeOffset = stepOffset * this._slideAnimationTime;
			return timeOffset;
		}
		
		/**
			Is a step or a slide currently in progress?
			@private
			@returns {Boolean}
		 */
		Carousel.prototype._isPlaying = function() { /*debug*///console.log("Carousel#_isPlaying()");
			return (
				(this._step && this._step.isPlaying())
				||
				this._slidePrev.isPlaying() || this._slideNext.isPlaying()
			);
		}
		
		/**
			Get the 0-based offset of the first currently visible carousel item.
			@private
			@returns {Number}
		 */
		Carousel.prototype._visibleIndexFirst = function() { /*debug*///console.log("_visibleIndexFirst()");
			// get the amount the carousel has slided as a positive number
			var slideOffset = parseInt( this._content.css("margin-" + this._direction) ) * -1;
			var offset = Math.floor(slideOffset / this._sizeEach);
			return this.items[offset]["_index"+glow.UID];
		}
		
		/**
			@name glow.widgets.Carousel#visibleIndexes
			@function
			@description Returns an array of numeric indexes of the currently visable items in the carousel.
			@returns {Array}
				Array of indexes of the currently visible items.
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer"{
					size: 3
				});
				myCarousel.moveTo(4);
				alert(myCarousel.visibleIndexes()); // returns [4, 5, 6]
		*/
		Carousel.prototype.visibleIndexes = function() {
			var leftmost = this._visibleIndexFirst();
			var visibleIndexes = [];

			for (var i = 0, l = this._opts.size; (i < l) /*&& (leftmost+i < this._countRealItems)*/; i++) {
				visibleIndexes.push((leftmost+i) % this._countReal);
			}

			return visibleIndexes;
		}
		
		/**
			@name glow.widgets.Carousel#visibleItems
			@function
			@description Returns a NodeList of all items currently visible in the carousel.
			@returns {glow.dom.NodeList}
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer"{
					size: 3
				});
				myCarousel.moveTo(4);
				alert(myCarousel.visibleItems()); // returns nodeList with 3 items starting from the carousel's 4th item
		 */
		Carousel.prototype.visibleItems = function() {
			var indexes = this.visibleIndexes();
			var visibleItems = new glow.dom.NodeList();
			for (var i = 0; i < indexes.length; i++) { 
				visibleItems.push(this.items[indexes[i]]);
			}
			return visibleItems;
		}
		
		/**
			@name glow.widgets.Carousel#addItems
			@function
			@description Used to add one or more new items to the carousel.
			@param {glow.dom.NodeList | Element | Selector} itemsToAdd A NodeList of items to add to the carousel.
			@param {Number} [position] Index at which to insert the items.  By default, items will be added to the end of the carousel.
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer"); // This &lt;ul&gt; has 3 &lt;li&gt; children
				alert(myCarousel.items); // returns 3 items
				myCarousel.addItems("ul#anotherList li"); // ul#anotherList has 2 &lt;li&gt; children
				alert(myCarousel.items); // returns 5 items
		*/
		Carousel.prototype.addItems = function(itemsToAdd, position) { /*debug*///console.log("Carousel#addItem("+itemsToAdd+", "+position+")");
			itemsToAdd = $(itemsToAdd);
			
			// fire event and cancel if prevented
			var eventProps = {
				items: itemsToAdd
			}
			if ( events.fire(this, "addItem", eventProps).defaultPrevented() ) {
				return itemsToAdd;
			}
			
			this._content.get(".carousel-added").remove(); // trim away added pads and clones
			if (typeof position != "undefined" && position < this._countReal) {
				itemsToAdd.insertBefore(this._content.children().item(position));
			}
			else {
				this._content.append(itemsToAdd);
			}
			rebuild.apply(this);
			
			return itemsToAdd;
		}
		
		/**
			@name glow.widgets.Carousel#removeItem
			@function
			@description Remove an item from the carousel.
			@param {Number} indexToRemove A numeric index of the item to remove.
			@returns {glow.dom.NodeList}
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer");
				alert(myCarousel.items); //returns array with a length of 5
				myCarousel.removeItem(4);
				alert(myCarousel.items); //returns array with a length of 4
		*/
		Carousel.prototype.removeItem = function(indexToRemove) { /*debug*///console.log("Carousel#removeItem("+indexToRemove+")");
				// check if it's the last item in the carousel and prevent removal if so
				if (this.items.length > 1) {
				    var removingItem = this.items.slice(indexToRemove, indexToRemove + 1),
					e = {
						item: removingItem,
						itemIndex: indexToRemove
					};
					    
				    if ( events.fire(this, "removeItem", e).defaultPrevented() ) {
					return removingItem;
				    }
	
				    this._content.get(".carousel-added").remove(); // trim away added pads and clones
				    removingItem.remove();			    
				    
				    rebuild.apply(this);
				}
				
			return removingItem;
		}
		
		/**
			@name glow.widgets.Carousel#moveBy
			@function
			@description Scrolls the carousel backwards or forwards through the items.
				Note: You cannot send a carousel out of sync with its step. It will
				scroll to a position where the item you've asked to move to is
				visible.
			@param {Number} distance The number of items to move by.  Positive numbers move forward, negative move backwards.
			@param {Boolean} animate Set to false to disable animation.
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer");
				myCarousel.moveNext();     // Move forward to the 2nd item.
				myCarousel.moveBy(3,true); // Move forward 3 from the current item to the 5th item
		 */
		Carousel.prototype.moveBy = function(distance, animate) { /*debug*///console.log("moveBy("+distance+", "+animate+")");
			var currentItem = this._visibleIndexFirst();
			var targetItem = currentItem + distance;
			if (this._opts.loop) { // the rolling jake...
				if (targetItem < 0) {
					this._content.css("margin-"+this._direction, (this._countReal * -this._sizeEach) + "px");
					targetItem = this._countReal + targetItem;
				}
				if (currentItem >= this._countReal && targetItem > this._countReal) {
					this._content.css("margin-"+this._direction, "0px");
					targetItem = targetItem % this._countReal;
				}
			}
			return this.moveTo(targetItem, animate);
		}
		
		/**
			@name glow.widgets.Carousel#moveTo
			@function
			@description Scroll to a specified position in the carousel.
				Note: You cannot send a carousel out of sync with its step. It will
				scroll to a position where the item you've asked to move to is
				visible.
			@param {Number} targetItem The index of the item to appear in the leftmost visible position of the carousel.
			@param {Boolean} animate Set to false to disable animation.
			@example
				var myCarousel = new glow.widgets.Carousel("ul#carouselContainer");
				myCarousel.moveTo(3,true); // Move to the 3rd item.
		*/
		Carousel.prototype.moveTo = function(targetItem, animate) { /*debug*///console.log("moveTo("+targetItem+", "+animate+")");
			var that = this;
			if (this._isPlaying()) return this;
			
			if (!this._opts.loop) targetItem = Math.min(targetItem, this._countReal-1);
			targetItem = Math.max(targetItem, 0);
			targetItem -= (targetItem % this._countStep); // stay in step
			if (!this._opts.loop) { // keep right items close to right-edge in the case of non-looping carousels
				targetItem = Math.min(targetItem, this._movesMax * this._countStep);
			}
			
			var currentItem = this._visibleIndexFirst();
		
			if (currentItem == targetItem) return this;
			
			beforeScroll.apply(this, []);
			if (animate !== false) {
				var move = {};
				move["margin-" + this._direction] = { from: (currentItem * -this._sizeEach) + "px", to: (targetItem * -this._sizeEach) + "px" };
				this._step = glow.anim.css(this._content, this._animationTime, move, { "tween": this._animationTween });
				var that = this;
				glow.events.addListener(this._step, "complete", function() {
					afterScroll.apply(that, []);
				});
				this._step.start();
			}
			else {
				this._content.css("margin-"+this._direction, (targetItem * -this._sizeEach) + "px");
				afterScroll.apply(this, []);
			}
			return this;
		}
		
		glow.widgets.Carousel = Carousel;
		
		/**
			@private
			@constructor
			@description Display the currently visible step.
		 */
		function PageNav(pagecount, onClick) {
			var localeModule = $i18n.getLocaleModule("GLOW_WIDGETS_CAROUSEL");
			
			this.leftarrow = dom.create("<li class='arrow' id='leftarrow'><a href='#' class='dotLabel'>{PREVIOUS}</a></li>", {interpolate: localeModule});
			this.rightarrow = dom.create("<li class='arrow' id='rightarrow'><a href='#' class='dotLabel'>{NEXT}</a></li>", {interpolate: localeModule});

			var pageNavHtml = "";
	
			for (var i = 0; i < pagecount; i++) {
//				pageNavHtml += "<li class='dot dot" + i + "' id='dot"+i+"'><div class='dotLabel'>"+(i+1)+"</div></li>";
				pageNavHtml += "<li class='dot dot" + i + "'><div class='dotLabel'>"+(i+1)+"</div></li>";
			}
			
			this.element = dom.create("<ul class='pageNav'>"+pageNavHtml+"</ul>");		
			this.leftarrow.insertBefore(this.element.get("li")[0]);
			this.rightarrow.insertAfter(this.element.get("li")[this.element.get("li").length-1]);
			
			var that = this;
			glow.events.addListener(this.element, "click",
				function(e) {
					if ($(e.source).parent().hasClass('dot')) { // clicked a dot?
//						var newPage = $(e.source).parent()[0].id.replace(/[^0-9]*/, "");
//						onClick.apply(that, [newPage]);
						onClick.apply(that, [parseInt($(e.source).html())-1]);
					}
				}
			);
			
			this.currentPage = 0;
		}
		
		PageNav.prototype.update = function(newPage) { /*debug*///console.log("PageNav.prototype.update("+newPage+")");
			if (typeof newPage == "undefined") newPage = this.currentPage;
			this.element.get("li.dot"+this.currentPage+"").removeClass("dotActive");
			this.element.get("li.dot"+newPage+"").addClass("dotActive");
			this.currentPage = newPage;
		}
	}
});(window.gloader || glow).module({
	name: 'glow.widgets.Editor',
	library: ['glow', '1.7.0'],
	depends: [[
		'glow', '1.7.0',
		'glow.dom',
		'glow.events',
		'glow.widgets',
		'glow.i18n',
		'glow.widgets.Overlay'
	]],
	
	builder: function(glow) {
		var $      = glow.dom.get, // shortcuts
			events = glow.events,
			$i18n  = glow.i18n;
			
		$i18n.addLocaleModule("GLOW_WIDGETS_EDITOR", "en", {
			ENTER_MESSAGE  : "You are about to enter a Rich Text Editor",
			SKIP_LINK_TEXT : "Skip past",
			LEAVE_MESSAGE  : "You have left the Rich Text Editor",

			BOLD_TITLE : "Bold",
			BOLD_LABEL : "B",

			ITALICS_TITLE : "Italics",
			ITALICS_LABEL : "I",

			STRIKE_TITLE : "Strikethrough",
			STRIKE_LABEL : "Strike",
			
			UNORDERED_TITLE : "Unordered list",
			UNORDERED_LABEL : "unordered list",
			
			ORDERED_TITLE : "Ordered list",
			ORDERED_LABEL : "ordered list",
			
			FORMATBLOCK_TITLE : "Text style",
			FORMATBLOCK_LABEL : "text style",
			
			HEADINGLEVELONE_TITLE : "Heading 1",
			HEADINGLEVELTWO_TITLE : "Heading 2",
			HEADINGLEVELTHREE_TITLE : "Heading 3",
			NORMAL_TITLE : "Normal"

			
		/*
			BLOCK_TITLE : "Blockquote",
			BLOCK_LABEL : "blockquote"

			HEADING1_TITLE : "Heading1",
			HEADING1_LABEL : "Heading1",

			TOGGLE_TITLE : "toggle",
			TOGGLE_LABEL : "toggle",
			
			** DONT FORGET THE OTHER LOCAL PACKS (eg CY)
		*/
		});
		
		/**
			@name glow.widgets.Editor
			@class
			@description A Rich Text Editor to allow text formatting with form inputs.

			<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>
			@constructor
			@param {String|glow.dom.NodeList} textarea Textarea HTML element that the Editor replaces on your page
			@param {Object} opts
			@_param {String} [opts.toolset="basic"]
			@param {String} [opts.theme="light"] Visual Theme
			Currently supported themes are "dark" and "light".
			@param {Function} [opts.onCommit] Event shortcut.
			See documentation below
			@_property {glow.dom.NodeList} element
			@_property {glow.dom.NodeList} textarea
			@_property {glow.widgets.Editor.Toolbar} toolbar
			@_property {glow.widgets.Editor.EditArea} editArea
			
			@example
				var editor = new glow.widgets.Editor("#commentEntry");

			@see <a href="../furtherinfo/widgets/editor/">Editor user guide</a>
		*/
		/**
			@name glow.widgets.Editor#event:commit
			@event
			@description Fired whenever the associated textarea is updated by the editor.
			@param {glow.events.Event} event Event Object

		 */
		glow.widgets.Editor = function(textarea, opts) {
			textarea = $(textarea);
			
			var editorLocaleModule = $i18n.getLocaleModule("GLOW_WIDGETS_EDITOR");
			
			this._tools = createTools(editorLocaleModule);

			opts = this._opts = glow.lang.apply(
				{
					toolset: "basic",
					onCommit: null
				},
				opts
			);
			// interpolate context
			this.element = glow.dom.create('<div class="glow170-editor"><p class="glow170-hidden">{ENTER_MESSAGE}, <a href="#endOfEditor' + endOfEditorCounter() + '" tabindex="0">{SKIP_LINK_TEXT}</a></p><div class="editor-' + (opts.theme || "light") + '"><div class="editor-state"></div></div><p id="endOfEditor' + endOfEditorCounter() + '" class="glow170-hidden endOfEditorCounter" tabindex="0">{LEAVE_MESSAGE}</p></div>', {interpolate : editorLocaleModule});
			this.textarea = textarea;
			this.toolbar = new glow.widgets.Editor.Toolbar(this);
			
			if (this._opts.toolset == "basic") {
				this.toolbar._addToolset("italics", "bold", "strike", "formatBlock", /*"blockquote",*/ "unorderedlist", "orderedlist");
			}
			else throw new Exception("Unknown toolset name.");
			
			this.editArea = new glow.widgets.Editor.EditArea(this);
			this.cleaner = new TagCleaner();
			
			// Safari 2 is not enhanced
			if (!isSafariTwo()) {
				place.apply(this);
				bindEditor.apply(this, []);
			}
			if (opts.onCommit){
				events.addListener(this, "commit", opts.onCommit);
			}
		}

////

/**
	@ignore
	@private
	@name endOfEditorCounter
	@description We need to give each hidden accessibility hidden message a unique id, so to do this add a number on the end.  Work out the number by counting how many of these links are already on the page.
  */
 var endOfEditorCounter = function() {
	return glow.dom.get('p.endOfEditorCounter').length+1;
 }


/**
	@ignore
	@private
    @name Idler
    @constructor
    @param {String|Object} attachTo The object to attach the idler to.
    @param {String|String[]} name The event name, or names for multiple events.
    @param {Number} wait The number of seconds to wait after no event occurs before the callback should run.
    @param {Object} [opts] Options object
    @param {Function} [opts.onFire] Function to run when this Idler fires.
    @param {Number} [opts.rate] Repeat the fire event every x seconds
 */

var Idler = function(attachTo, name, wait, opts) { /*debug*///console.info("new Idler()");
	opts = this._opts = glow.lang.apply(
		{
			onFire: function() {}
		},
		opts
	);
	
	var that = this;
	this.attachTo = attachTo;
	this.name = name;
	this.wait = wait;
	this.callback = opts.onFire;
	this.rate = opts.rate;
	this.running = false;
	this.initiated = false;
	
	if (typeof this.name.pop == "undefined") { // is it an array?
		this.name = [this.name];
	}
	
	for (var i = 0, l = this.name.length; i < l; i++) {
		var name = this.name[i];
		glow.events.addListener(
			this.attachTo,
			name,
			function() {
				clearInterval(that.intervalId);
				clearTimeout(that.timeoutId);
				that._tick();
			}
		);
	}
	
	this._start();
}

/**
	@ignore
	@private
	@name Idler#disabled
	@function
	@param {Boolean} [disabledState]
	@description Sets/gets the disabled state of the Idler. When disabled, any running
    timers are cancelled and no new timers can be started.
 */
Idler.prototype.disabled = function(disabledState) {
	if (typeof disabledState == "undefined") {
		return !this.running;
	}
	else {
		if (disabledState) this._stop();
		else this._start();
	}
}

Idler.prototype._tick = function() {/*debug*///console.info("Idler._tick()");
	var that = this;
	this.timeoutId = setTimeout(
		function() {
			if (typeof that.rate != "undefined") {
				that.intervalId = setInterval(that.callback, that.rate);
			}
			else {
				that.callback();
			}
		},
		that.wait
	);
}

/**
	@ignore
	@private
	@name Idler#_start
	@function
	@description Start the idler, if it is not already running.
 */
Idler.prototype._start = function() {
	if (this.running) return;

	this._tick();
	
	this.running = true;
}

/**
	@ignore
	@private
	@name Idler#_stop
	@function
	@description Stop the idler, if it is running.
 */
Idler.prototype._stop = function() {
	if (!this.running) return;
	
	clearInterval(this.intervalId);
	clearTimeout(this.timeoutId);
	
	this.running = false;
}

////		

		/**
			@ignore
			@private
			@name place
			@function
			@description Positions the toolbar over the textarea.
			@this glow.widgets.Editor.Toolbar
		 */
		function place() {
			var inputOffset = this.textarea.offset();
			var height = (this.textarea[0].offsetHeight > 142) ? this.textarea[0].offsetHeight : 142;

			this.element.css('width', (this.textarea[0].offsetWidth-2) + 'px');
			this.element.css('height', (height-2) + 'px');
		}

		var bindEditor = function() {
			// Add the widget into the page
			this.textarea.before(this.element);

			// Redo height of the iframe.  We need to do it here because we can only get the correct height when the element is in the page.
			this.element.get('iframe').css( 'height', (parseInt(this.element.css('height'))-42) );

			// Set the textarea so the user can't see it (but a screen reader can)
			this.textarea.css("display", "block");
			this.textarea.css("position", "absolute");
			this.textarea.css("left", "-9999px");
			this.textarea.css("top", "-9999px");
			
			this.bound = true;
		}
		
////////
		glow.widgets.Editor.prototype.inject = function(html) {
			this.editArea._setContent(this.cleaner.dirty(this.cleaner.clean(html)));
		}
		
		glow.widgets.Editor.prototype.commit = function() {
			if (this.bound) {
				$(this.textarea).val(this.cleaner.clean(this.editArea._getContent()));
			}
			glow.events.fire(this, "commit", {});
		}
				
		function TagCleaner(opts) {
			// assumes nesting of dirty tags is always valid
			// assumes no '>' in any dirty tag attributes
			// assumes attributes are quoted with double-quotes, and attribute values contain no escaped double-quotes

			this.opts = opts || {};
			
			this.whitelist = ["em", "strong", "strike", "p", "br", /*"blockquote",*/ "ul", "ol", "li", "h1", "h2", "h3"]; // TODO: support tags.attributes
		}
		
		// runs before clean
		TagCleaner.prototype.pretreat = function(input) {
			// remove html comments
			input = input.replace(/<!--[\s\S]*?-->/g, "");
			
			// remove style tags and their contents
			input = input.replace(/<style\b[\s\S]*?<\/style>/gi, "");
			
			// remove script tags and their contents
			input = input.replace(/<script\b[\s\S]*?<\/script>/gi, "");
			
			return input
		}
		
		TagCleaner.prototype.clean = function(input) { /*debug*///console.log("TagCleaner#clean("+input+")")
				var output = "",
			    stack = [];
			    
			    input = this.pretreat(input);
			    
//var sanity = 99;			
			while (input) {
//if (sanity-- == 0) throw new Error("stoopid loops");
				var skip = 1; // characters

				if (/^(<[^>]+>)/.test(input)) { // tag encountered
					var foundTag = new TagCleaner.Tag(RegExp.$1);

					this.tagClean(foundTag);
					
					if (foundTag.clean && foundTag.opening) { // there's a clean version
						output += foundTag.clean.start;
						if (!foundTag.unary) stack.unshift(foundTag);
						skip = foundTag.text.length;
					}
					else if (stack[0] && input.toLowerCase().indexOf(stack[0].end) === 0) { // found tag was closed
						output += stack[0].clean.end;
						skip = stack[0].end.length;
						stack.shift();
					}
					else { // unknown tag
						output += foundTag;
						skip = foundTag.text.length;
					}
				}
				else { // non-tag content
					output += input.charAt(0);
				}
			
				// move ahead
				input = input.substring(skip);
			}
			
			output = this.spin(output);
			
			return output;
		}
		
		TagCleaner.prototype.dirty = function(clean) {
			var dirty;
	
			if (glow.env.gecko) { // mozilla?
				dirty = clean
					.replace(/<strong>/g, '<b _moz_dirty="">').replace(/<\/strong>/g, '</b>')
					.replace(/<em>/g, '<i _moz_dirty="">').replace(/<\/em>/g, '</i>')
					.replace(/<strike>/g, '<strike _moz_dirty="">')
				;
			}
			else if (glow.env.ie || glow.env.opera) {
				dirty = clean
					.replace(/<strong>/g, '<STRONG>').replace(/<\/strong>/g, '</STRONG>')
					.replace(/<em>/g, '<EM>').replace(/<\/em>/g, '</EM>')
					.replace(/<strike>/g, '<STRIKE>').replace(/<\/strike>/g, '</STRIKE>')
				;
			}
			else if (glow.env.webkit > 528) { // safari 4? TODO: same as safari 2?
				dirty = clean
					.replace(/<strong>/g, '<b>').replace(/<\/strong>/g, '</b>')
					.replace(/<em>/g, '<i>').replace(/<\/em>/g, '</i>')
					.replace(/<strike>/g, '<span class="Apple-style-span" style="text-decoration: line-through;">').replace(/<\/strike>/g, '</span>')
				;
			}
			else if (glow.env.webkit) {  // safari 3?
				dirty = clean
					.replace(/<strong>/g, '<span class="Apple-style-span" style="font-weight: bold;">').replace(/<\/strong>/g, '</span>')
					.replace(/<em>/g, '<span class="Apple-style-span" style="font-style: italic;">').replace(/<\/em>/g, '</span>')
					.replace(/<strike>/g, '<span class="Apple-style-span" style="text-decoration: line-through;">').replace(/<\/strike>/g, '</span>')
				;
			}
			else { throw new Error("Can't be dirty: Unknown browser."); }
			
			return dirty;
		}
		
		/**
			@ignore
			@private
			@description A single span can become a combination of several semantic tags.
			@param {TagCleaner.Tag} tag A span Tag object.
			@returns {String[]} An array of [0] opening tag or tags as a string and [1] closing tag or tags as a string.
		 */
		TagCleaner.prototype.spanClean = function(tag) {
			var clean = {start:"", end:""};
			
			if (/\bstyle\s*=\s*"(.+)"/.test(tag.attrText.toLowerCase())) {
				if (RegExp.$1.indexOf("bold") > -1) {
					clean.start += "<strong>";
					clean.end = "<\/strong>"+clean.end;
				}
				// safari needs this
				if (RegExp.$1.indexOf("font-weight: normal") > -1) {
					clean.start += "<\/strong>";
					clean.end = "<strong>"+clean.end;
				}
				
				if (RegExp.$1.indexOf("italic") > -1) {
					clean.start += "<em>";
					clean.end = "<\/em>"+clean.end;
				}
				
				// safari needs this
				if (RegExp.$1.indexOf("font-style: normal") > -1) {
					clean.start += "<\/em>";
					clean.end = "<em>"+clean.end;
				}
				
				if (RegExp.$1.indexOf("line-through") > -1) {
					clean.start += "<strike>";
					clean.end = "<\/strike>"+clean.end;
				}
			}
			
			return clean;
		}
		
		/**
			@ignore
			@private
			@description Given a dirty tag, add a clean tag property, if one can be found.
			@param {TagCleaner.Tag} tag A dirty Tag object.
			@returns {String[]} An array of [0] opening tag or tags as a string and [1] closing tag or tags as a string.
		 */
		 TagCleaner.prototype.tagClean = function(tag) {
			var clean = ["", ""];	
			
			if (tag.name == "span")   clean = this.spanClean(tag);
			else if (tag.name == "b") clean = {start:'<strong>', end:'<\/strong>'};
			else if (tag.name == "i") clean = {start:'<em>', end:'<\/em>'};
			
			if (clean.start) tag.clean = clean;
		}
		
		TagCleaner.Tag = function(tagText) { /*debug*///console.log("new TagCleaner.Tag("+tagText+")");
			/^<(\/?)([a-zA-Z1-6]+)\b(.*)( ?\/)?>$/.exec(tagText);
			this.closing = !!RegExp.$1;
			this.opening = !this.closing;
			this.unary = !!RegExp.$4;
			this.name = RegExp.$2.toLowerCase();
			this.attrText = RegExp.$3;
			this.text = tagText;
			
			// normalise case of tag names
			this.start = tagText.replace(/^<(\/?)([a-zA-Z]+)\b/, "<$1"+this.name);
			
			if (this.opening && !this.unary) {
				this.end = "<\/"+this.name+">";
			}
		}
		TagCleaner.Tag.prototype.toString = function() {
			return "<" + RegExp.$1 + this.name/* + this.attrText */+ RegExp.$4 +">";
		}
		
		TagCleaner.prototype.spin = function(input) {
			var whitetags = this.whitelist.join("\|");
			// note: Safari 2.0.4 doesn't support unicode in regex, but can use unprintable ASCII characters, like the "Group Separator"
			var allowedTags = new RegExp("<(\\/?("+whitetags+")\\b[^>]*)>", "g");
			input = input.replace(allowedTags, "\x1D$1\x1D");     // hide allowed tags
			input = input.replace(/<[^>]+>/g, "");                // kill all visible tags
			input = input.replace(/\x1D([^\x1D]+)\x1D/g, "<$1>"); // restore allowed tags
			
			// general final clean up...
			input = input.replace(/<>/g, ""); // remove Safari droppings
			
			return input;
		}
		
////////

		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar
			@description
			@constructor
			@_param {glow.widgets.Editor} editor
			@_param {Object} opts
		 */
		glow.widgets.Editor.Toolbar = function(editor, opts) {
			opts = opts || {};
			this.editor = editor;
			this.element = glow.dom.create('<fieldset class="editor-toolbar"><ul class="editor-toolbar-tools"></ul></fieldset>');
			this._tools = [];
			this.editor.element.get(".editor-state").prepend(this.element);
		}
			
		 /**
		     @ignore
		     @private
			 @name glow.widgets.Editor.Toolbar#_addToolset
			 @description Quickly add several tools at once to the toolbar.
			 @function
			 @param {String} ... Either the name of a built-in set of tools,
			 like "fontFormatting" [TBD] and/or the predefined names of
			 built-in tools.
			 @returns {glow.widgets.Editor.Toolbar} this
			 @example
				myToolbar._addToolset("Bold", "Italics")
				.addButton("MyCustomButton", opts); // will be chainable
		 */
		 glow.widgets.Editor.Toolbar.prototype._addToolset = function(/*arguments*/) {
		 	var toolToAdd;
		 	
		 	for (var i = 0, l = arguments.length; i < l; i++) {
		 		if ( (toolToAdd = this.editor._tools[arguments[i]]) ) {
		 			toolToAdd.opts.theme = this.editor._opts.theme; // tools inherit theme from associated editor theme
					addTool.call(this, glow.widgets.Editor.Toolbar.prototype._toolFactory(toolToAdd));
				}
		 	}
		 	
			// Give the toolbar one focusable button
			// this.element.get('a').item(0).tabIndex = 0;
			addToolbarIntoTabIndex.apply(this);

		 	return this;
		 }
		
		 /**
		     @ignore
		     @private
			 @name glow.widgets.Editor.Toolbar#_toolFactory
			 @description Factory for building different kinds of toolbar tools.
			 @function
			 @param {this.editor._tools} 
			 @returns {glow.widgets.Editor.Toolbar.tool} this
		 */
		 glow.widgets.Editor.Toolbar.prototype._toolFactory = function(toolToAdd, editorRef) {
			var newTool;
			switch(toolToAdd.type) {
				case "button":
					newTool = new glow.widgets.Editor.Toolbar.Button(toolToAdd.name, toolToAdd.opts);
					break;
				case "dropDown":
					newTool = new glow.widgets.Editor.Toolbar.DropDown(toolToAdd.name, toolToAdd.opts);
					break;
			}
			return newTool;
		 }
		
		// modifies HTML in place, while preserving the cursor position
		glow.widgets.Editor.blackList = {
			FORM:       true,
			TABLE:      true,
			TBODY:      true,
			CAPTION:	true,
			TH:			true,
			TR:         true,
			TD:         true,
			SCRIPT:     true,
			STYLE:      true,
			INPUT:      true,
			BUTTON:     true,
			OBJECT:		true,
			EMBED:		true,
			SELECT:     true,
//			H1:         true,
//			H2:         true,
//			H3:         true,
			H4:         true,
			H5:         true,
			H6:         true,
			DIV:        true,
			ADDRESS:	true,
//			BLOCKQUOTE: true,
			CENTER:		true,
			PRE:        true,
			CODE:       true,
			A:          true,
//			UL:         true,
//			OL:         true,
//			LI:         true,
			DL:         true,
			DT:         true,
			DD:         true,
			ABBR:       true,
			ACRONYM:	true,
			DFN:		true,
			INS:		true,
			DEL:		true,
			SAMP:		true,
			VAR:		true,
			BIG:		true,
			SMALL:		true,
			BLINK:		true,
			MARQUEE:    true,
			FONT:       true,
			Q:			true,
			U:			true,
			KBD:		true,
			SUB:		true,
			SUP:		true,
			CITE:       true,
			HTML:       true,
			BODY:       true,
			FIELDSET:   true,
			LEGEND:     true,
			LABEL:      true,
			TEXTAREA:   true,
			HR:         true,
			IMG:        true,
			IFRAME:     true,
			ILAYER:     true,
			LAYER:      true
        };
		glow.widgets.Editor.prototype._rinse = function() { /*debug*///console.log("glow.widgets.Editor#_rinse()");		
			if (this._lastRinse == this.editArea._getContent()) return; /*debug*///console.log("rinsing");

			var doc = this.editArea.contentWindow.document;
			var node = doc.body;
			
			var that = this; // keep track of me, even when recursing
			function walkNode(node) {
				if (node.childNodes) {
					for (var i = 0; i < node.childNodes.length; i++) {
						var keepStatus = glow.widgets.Editor.blackList[node.childNodes[i].nodeName];
						
						if (node.nodeType == 1) { // an element node
							if (keepStatus) {
									var replacementNode = doc.createElement("SPAN");
									//replacementNode.setAttribute('class', 'glow-rinsed');
									
									replacementNode.innerHTML = that.cleaner.clean(node.childNodes[i].innerHTML+" ");
									node.replaceChild(replacementNode, node.childNodes[i]);
							}
							else {
								// it's an allowed node but we should limit external styles as much as possible
								if (node.childNodes[i].nodeName == "P") node.childNodes[i].removeAttribute("style");
								if (node.childNodes[i].nodeName == "SPAN") { // webkit may use font-size spans to show headings
									if (/font-size/.test(node.childNodes[i].getAttribute("style"))) node.childNodes[i].removeAttribute("style");
								}
								walkNode(node.childNodes[i]);
							}
						}
					}
				}
				else {
					if (glow.widgets.Editor.blackList[node.nodeName]) {
						node.parentNode.removeChild(node);
					}
				}
			}

			walkNode(node);
			
			this._lastRinse = this.editArea._getContent();
		}

		/**
			@ignore
			@name addTool
			@private
			@function
			@param {glow.widgets.Editor.Toolbar.Tool} toolToAdd
		 */
		function addTool(toolToAdd) { /*debug*///console.log("addTool("+toolToAdd+")")
		 	toolToAdd.editor = this.editor;
		 	this._tools.push(toolToAdd);
			this.element.get(".editor-toolbar-tools").append(toolToAdd.element);
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar#addButton
			@description
			@function
			@param {String} name
			@param {Object} opts
		 */
		glow.widgets.Editor.Toolbar.prototype.addButton = function(name, opts) {
			var newTool = new glow.widgets.Editor.Toolbar.Button(name, opts, this);
			addTool.call(this, newTool);
			return this;
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar#getTool
			@description
			@function
			@param {String} name
			@returns {glow.widgets.Editor.Toolbar.Tool}
		 */
		glow.widgets.Editor.Toolbar.prototype.getTool = function(name) {
			var i = this._tools.length;
			while (--i >= 0) {
				if (this._tools[i].name == name) return this._tools[i];
			}
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar#_update
			@description
			@function
			@param {String} name
			@returns {glow.widgets.Editor.Toolbar.Tool}
		 */
		glow.widgets.Editor.Toolbar.prototype._update = function(domPath) { /*debug*///console.log("glow.widgets.Editor.Toolbar.prototype._update("+domPath+")")
		 	var handled = false;
		 	for (var i = 0, l = this._tools.length; i < l; i++) {
				// ***
				// The dropdown has multilple tag values, so we need to do things a bit different...
				// MAYBE WE SHOULD MOVE THIS INTO THE DROPDOWN OBJECT?
				if(this._tools[i].type == "dropdown") {
					var regex = new RegExp("/\|(" + this._tools[i].tag + ")\|/"),
						domPathMatches = domPath.match(regex);
					if (domPathMatches != null) {
						this._tools[i].label( this._tools[i].overlayMenu.getTitleFromTag(domPathMatches[0]) );
					}
					else {
						this._tools[i].label( "Normal" );
					}
					
				}
				else if (domPath.indexOf("|"+this._tools[i].tag+"|") > -1) {
		 			this._tools[i].activate();
		 			handled = true;
		 		}
		 		else {
		 			this._tools[i].deactivate();
		 		}
			}
		 	return handled;
		}
		
		/** 
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar#_shortcut 
			@description 
			@function 
			@param {String} name 
			@returns {glow.widgets.Editor.Toolbar.Tool} 
		 */ 
	   glow.widgets.Editor.Toolbar.prototype._shortcut = function(letter) { 
			var i = this._tools.length;
			var handled = false;
			while (--i >= 0) { 
				if (this._tools[i].shortcut == letter) {
					this._tools[i].press(); 
					return true;
				}
			} 
			return false;
	   }

////////

		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool
			@constructor
			@description Generic base class for all Tools.
		 */
		glow.widgets.Editor.Toolbar.Tool = function(name, opts, context) { /*debug*///console.log("glow.widgets.Editor.Toolbar.Tool("+name+", "+opts.toSource()+")")
			this.name = name;
			this.opts = opts || {};
			this.action = this.opts.action || function(){};
			this.tag = this.opts.tag;
			this.command = this.opts.command;
			this.shortcut = this.opts.shortcut;
			this.isActive = false;
			this.isEnabled = true;
			
			if (this.opts.onDeactivate) glow.events.addListener(this, "deactivate", this.opts.onDeactivate, context);
			if (this.opts.onActivate)   glow.events.addListener(this, "activate", this.opts.onActivate, context);
			if (this.opts.onDisable)    glow.events.addListener(this, "disable", this.opts.onDisable, context);
			if (this.opts.onEnable)     glow.events.addListener(this, "enable", this.opts.onEnable, context);
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool#activate
			@description
			@function
		 */
		 glow.widgets.Editor.Toolbar.Tool.prototype.activate = function() { /*debug*///console.log(this.type+".activate()");
			this.isActive = true;
			glow.events.fire(this, 'activate');
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool#deactivate
			@description
			@function
		 */
		glow.widgets.Editor.Toolbar.Tool.prototype.deactivate = function() { /*debug*///console.log(this.type+".deactivate()");
			this.isActive = false;
			glow.events.fire(this, 'deactivate');
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool#disable
			@description
			@function
		 */
		glow.widgets.Editor.Toolbar.Tool.prototype.disable = function() {
			this.isEnabled = false;
			glow.events.fire(this, 'disable');
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool#enable
			@description
			@function
		 */
		glow.widgets.Editor.Toolbar.Tool.prototype.enable = function() {
			this.isEnabled = true;
			glow.events.fire(this, 'enable');
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Tool#press
			@description
			@function
		 */
		glow.widgets.Editor.Toolbar.Tool.prototype.press = function() {
			if (this.isEnabled) {
				this.action.call(this);
				if (!this.isActive && this.type == "button") this.activate();
				else this.deactivate();
				this.editor._lastDomPath = null; // invalidate the current dom path (this is required on some browsers that "wrap" selections) to force ondompathchange to fire when the user clicks away from the current selection
			}
		}

////////

		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.Button
			@constructor
			@extends glow.widgets.Editor.Toolbar.Tool
		 */
		glow.widgets.Editor.Toolbar.Button = function(name, opts) { /*debug*///console.log("new glow.widgets.Editor.Toolbar.Button("+name+", "+opts.toSource()+")")
			this.Base = arguments.callee.base; this.base = this.Base.prototype;
			this.Base.apply(this, arguments);
			

			this.type = "button";

			
			// a button's CSS classname is defined here 
			var buttonClass = name.toLowerCase() + "-button";
			this.element = glow.dom.create('<li class="editor-toolbar-item"><span class="editor-toolbar-button"><a href="#" title="'+(opts.title || name)+'" tabindex="-1"><span class="editor-toolbar-icon '+buttonClass+'"><span>'+(opts.label || name)+'<\/span><\/span><\/a><\/span><\/li>');
 			
 			// shortcuts
 			var toolLink = this.element.get("a");
 			this.icon = this.element.get(".editor-toolbar-icon"); 
 
			var key_listener;

 			glow.events.addListener(this.icon, "mouseover", function() { if (this.isEnabled && !this.isActive) toolLink.addClass("hover"); }, this);
			glow.events.addListener(toolLink, "focus", function() { if (this.isEnabled) {toolLink.addClass("hover"); key_listener = enable_key_listener(this);} }, this);
 			glow.events.addListener(this.icon, "mouseout",  function() { toolLink.removeClass("hover"); }, this);
			glow.events.addListener(toolLink, "blur",  function() { toolLink.removeClass("hover"); glow.events.removeListener(key_listener);}, this);
 			glow.events.addListener(this, "disable", function() { toolLink.addClass("disabled"); }, this);
 			glow.events.addListener(this, "enable", function() { toolLink.removeClass("disabled"); }, this);
 			glow.events.addListener(this, "activate", function() { if (this.isEnabled) {toolLink.addClass("active");} }, this);
 			glow.events.addListener(this, "deactivate", function() { toolLink.removeClass("active"); }, this);

 			var that = this;
			glow.events.addListener(this.element.get("a"), "mousedown", function() { that.press(); return false; }, this); // bind the click handler context to the Tool (not the HTMLElement)
			glow.events.addListener(this.element.get("a"), "click", function() { return false; }); 
		}
		
		glow.lang.extend(glow.widgets.Editor.Toolbar.Button, glow.widgets.Editor.Toolbar.Tool);
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.DropDown
			@constructor
			@extends glow.widgets.Editor.Toolbar.Tool
		 */
		glow.widgets.Editor.Toolbar.DropDown = function(name, opts) { /*debug*///console.log("new glow.widgets.Editor.Toolbar.DropDown("+name+", "+opts.toSource()+")")
			
			// this is at the begining of all the objects that extend glow.widgets.editor.toolbar.tool - is this the right way to do it?
			this.Base = arguments.callee.base;
			this.base = this.Base.prototype;
			this.Base.apply(this, arguments);

			this.type = "dropdown";
			
			this._opts = {
				title: opts.title || name,
				label: opts.lable || name,
				theme: opts.theme || 'light'
			};

			// create dropdown tool-link element
			var buttonClass = name.toLowerCase() + "-dropDown"; // like: formatblock-dropDown
			this.element = glow.dom.create('<li class="editor-toolbar-item"><span class="editor-toolbar-dropdown"><a href="#" title="'+this._opts.title+'" tabindex="-1"><span class="'+buttonClass+'"><span>'+this._opts.label+'<\/span><\/span><\/a><\/span><\/li>');

 			// shortcuts
 			var that = this,
				toolLink = this.element.get("a");
 				this.icon = this.element.get(".editor-toolbar-dropdown"); 
 
			// create overlaymenu child obect - this is used as the menu when the drop-down tool-link is clicked on
			this.overlayMenu = new glow.widgets.Editor.Toolbar.OverlayMenu(
				this,
				{
					menuItems: opts.menuItems,
					onClick: function(e) {
						
						// change the dropdown tool-link label
						that.label(that.overlayMenu.menuItems[that.overlayMenu.selected].title);
	
						// fire tool-link - again, this is done from the overlayMenu because the tool-link isn't being interacted with
						//events.fire(that, "activate");
						that.press();
						//events.fire(that, "deactivate");
						//that.deactivate();
						
						if (glow.env.ie) {
							that.editor.editArea.contentWindow.focus();
						}
						
					}
				}
			);

			// getter/setter for the label of the tool-link
			this.label = function(newLabel) {
				if (typeof newLabel != "undefined") {	
					that.element.get("a span span").html(newLabel);
					return this;
				}
				else {
					return that.element.get("a span span").html();
				}
			}


			// set the label to be the last text entry (normal text) in the overlaymenu
			this.label(this.overlayMenu.menuItems[this.overlayMenu.selected].title);


			// ***
			// mouse events
			// clicking on the tool-link opens the overlaymenu (closing the overlaymenu handled inside overlaymenu object)
			glow.events.addListener(that.element.get("a"), "click", function() {
				_openOverlayMenu();
				return false;
			});
			glow.events.addListener(this.element.get("a"), "mousedown", function() { return false; });
			// ***


			// ***
			// roll over events
			glow.events.addListener(that.icon, "mouseover", function() {
				if (this.isEnabled && !this.isActive) {
					toolLink.addClass("hover");
				}
			}, this);
			glow.events.addListener(toolLink, "focus", function() {
				if (this.isEnabled) {
					toolLink.addClass("hover");
				}
			}, this);
			glow.events.addListener(this.icon, "mouseout",  function() {
				toolLink.removeClass("hover");
			}, this);
			glow.events.addListener(toolLink, "blur",  function() {
				toolLink.removeClass("hover");
			}, this);
			// ***


			// ***
			// enable/disable events
			glow.events.addListener(this, "disable", function() {
				toolLink.addClass("disabled");
			}, this);
 			glow.events.addListener(this, "enable", function() {
				toolLink.removeClass("disabled");
			}, this);
			// ***
 			
			
			// ***
			// activate/deactivate events
			glow.events.addListener(this, "activate", function() { /*debug*///console.log("activate");
				if (this.isEnabled) {
					toolLink.addClass("active");
				}
			}, this);
 			glow.events.addListener(this, "deactivate", function() {/*debug*///console.log("deactivate");
				toolLink.removeClass("active");
			}, this);
			// ***
			
			
			// ***
			// keypress events
			glow.events.addListener(toolLink, "keydown", function(e) {

				// Open the overlayMenu
				if(e.key == "DOWN") {
					// Open the overlay
					_openOverlayMenu();
					
					// Always hightlight the item in the dropDown that is currently displayed in the tool
					var toolText = $(this).text();
					that.overlayMenu.container.get("li").each(function(i){
						var li = $(this);
						if(li.text() == toolText) {
							li[0].tabIndex = 0;
							li[0].focus();
						}
					});
					
					return false;
				}
				// Close the overlayMenu
				if(
					   (e.key == "LEFT")
					|| (e.key == "RIGHT")
				) {
					_closeOverlayMenu.call(that);
					return false;
				}
			});

			// opens the overlaymenu and sets it to appear below the dropdown toollink
			function _openOverlayMenu() { /*debug*///console.log("_openOverlayMenu()");
				that.activate();
				that.overlayMenu.show();
				var inputOffset = that.element.offset();
				that.overlayMenu.container
					.css("left", (inputOffset.left + 5))
					.css("top", (inputOffset.top + that.element[0].offsetHeight + 2));
			}		
		}

		function _closeOverlayMenu() { /*debug*///console.log("_closeOverlayMenu()");
			this.deactivate();
			this.overlayMenu.hide();
		}
		
		glow.lang.extend(glow.widgets.Editor.Toolbar.DropDown, glow.widgets.Editor.Toolbar.Tool);

		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.OverlayMenu
			@constructor
			@param {Object} opts Options object
				@param {Array} [opts.menuItems] Array of objects with values to set the menu items to
					Expects the following structure - menuItems: [{title: 'foo', tag: 'bar'}]
				@param (Function) [opts.onClick] Shortcut to attach an event listener that is called when the user clicks on the overlayMenu.
		 */
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.OverlayMenu#menuItems
			@type Array
			@description Array of items that are on the overlayMenu.
		*/
		/**
			@ignore
			@private
			@name glow.widgets.Editor.Toolbar.OverlayMenu#selected
			@type Number
			@description Indicates index value of selected menu item
		*/
		glow.widgets.Editor.Toolbar.OverlayMenu = function(dropDown, opts) { /*debug*///console.log("new glow.widgets.Editor.Toolbar.OverlayMenu("+opts+", "+dropDown+")");

			var overlayMenuContents = glow.dom.create('<ul></ul>'), // html for the overlay
				overlayMenu,
				that = this;

			// default function requires a glow.dom.nodeList passed in, will return the html of the nodeList
			// This param allows you to customise how each menuItem looks
			// DON'T THINK WE NEED THIS?
			opts.formatItem = opts.formatItem || function(o) { return o.html(); };
						
			// default empty function for onclick
			opts.onClick = opts.onClick || function() {};

			// create an overlay that we will use for the menu
			overlayMenu = new glow.widgets.Overlay(overlayMenuContents, {
				className: 'overlayMenu',
				mask: new glow.widgets.Mask({
					opacity: 0
				}),
				modal: true,
				closeOnEsc: true,
				autoPosition: false
			});
			
			// inherit the theme of the dropdown we are associated with
			if (dropDown._opts.theme) {
				overlayMenu.container.addClass('overlayMenu-' + dropDown._opts.theme);
			}

			// Add opts.menuItems onto the overlayMenu. This make
			overlayMenu.menuItems = opts.menuItems;
			
			// param to tell user the index value of the selected menuItem.
			// default value is null as nothing has been selected yet.
			overlayMenu.selected = null;
			
			// add menuItems onto overlayMenu HTML as <li>s
			var z = 0;
			for (menuItem in overlayMenu.menuItems) {
				// shortcut
				menuItem = overlayMenu.menuItems[menuItem];
				// create and add the html to the overlayMenuContents
				overlayMenuContents.append(glow.lang.interpolate(menuItem.template, {title: menuItem.title}));
				// if menuItem.selected == true then set overlayMenu.selected to the index value
				menuItem.selected = menuItem.selected || false;
				if (menuItem.selected == true) {
					overlayMenu.selected = z;
				}
				z++;
			}
			
			// when the overlayMenu is hidden by clicking on the mask then deactivate the dropDown tool-link
			events.addListener(overlayMenu, 'hide', function(){
				if (dropDown.isActive == true) {
					events.fire(dropDown, 'deactivate');
					dropDown.isActive = false;
				}
			});
			
			// pass in a tag, and if the tag matches one of the tags in the menuItems return the matching menuItem's title
			overlayMenu.getTitleFromTag = function(tag) {
				for (menuItem in overlayMenu.menuItems) {
					menuItem = overlayMenu.menuItems[menuItem];
					if (menuItem.tag == tag) {
						return menuItem.title;
					}
				}
				// return null if no tag matches
				return null;
			}
			
			var arrLi = overlayMenu.container.get("li");
			events.addListener(overlayMenuContents, "mouseover", function(e) {
				_highlightMenuItem($(e.source), arrLi);
				e.source.focus();
			});
			events.addListener(overlayMenuContents, "mouseout", function(e) {
				_disableTabIndex(e.source);
			});
			events.addListener(overlayMenuContents, "focus", function(e) {
				_highlightMenuItem($(e.source), arrLi);
			});
			events.addListener(overlayMenuContents, "blur", function(e) {
				_disableTabIndex(e.source);
			});
			events.addListener(overlayMenuContents, "mousedown", function(e) {
				_menuItemClick(e);
				return false
			});

			events.addListener(overlayMenuContents, "keydown", function(e) {

				var toolLink = dropDown.element.get("a");
				switch(e.key) {
					case "UP":
						moveFocusLeft(e, arrLi);
						break;
					case "DOWN":
						moveFocusRight(e, arrLi);
						break;
					case "ESC":
						_closeOverlayMenu.call(dropDown);
						// If keyboard access is being used then we want to throw the focus at the toollink
						toolLink[0].focus();
						break;
					case "LEFT":
						// Fake a LEFT ARROW key press on the dropDown tool in the editor toolbar
						toolLink[0].focus();
						moveFocusLeft(new events.Event({source: toolLink[0]}), dropDown.editor.toolbar.element.get("a"));
						_closeOverlayMenu.call(dropDown);
						break;
					case "RIGHT":
						// Fake a RIGHT ARROW key press on the dropDown tool in the editor toolbar
						toolLink[0].focus();
						moveFocusRight(new events.Event({source: toolLink[0]}), dropDown.editor.toolbar.element.get("a"));
						_closeOverlayMenu.call(dropDown);
						break;
					case "ENTER":
						_menuItemClick(e);
				}

				return false;
			});
			// keypress event needs to return false so Opera doesn't delete the selection in the iframe
			events.addListener(overlayMenuContents, "keypress", function(e){
				e.preventDefault();
				return false;
			});
			// Internal click function.  Calls user defined click event
			function _menuItemClick(e) {
				var source = $(e.source);

				// Remove highlighted class
				source.removeClass("highlighted");

				// set the selected index
				overlayMenu.selected = _findPositionInNodelist(source);

				// close overlay
				_closeOverlayMenu.call(dropDown);

				// Call user defined click event
				opts.onClick(e);
			}
			
			return overlayMenu;
		}
		
		// Pass in an element, and this function will return the index value of its position amongst its siblings
		function _findPositionInNodelist(elm) {
			var siblings = $(elm).parent().children(),
				r = 0;
			siblings.each(function(y) {
				if (this == elm.item(0)) {
					r = y;
				}
			});
			return r;
		}
		
		function _highlightMenuItem(li, arrLi) {
			arrLi.each(function(q) {
				$(arrLi[q]).removeClass("highlighted");
			});
			li.addClass("highlighted");
		}
		
		// Disables (sets to -1) the tabIndex of the passed in element
		function _disableTabIndex(elm){
			elm.tabIndex = -1;
		}

		

// TODO: all these would be better handled by onWhatever event handlers passed into the Tool constructor call
		glow.widgets.Editor.Toolbar.Button.prototype.activate = function() {
			this.base.activate.apply(this, arguments);
		}
		
		glow.widgets.Editor.Toolbar.Button.prototype.deactivate = function() {
			this.base.deactivate.apply(this, arguments);
		}
		
		glow.widgets.Editor.Toolbar.Button.prototype.enable = function(name) {
			this.base.enable.apply(this, arguments);
		}
		
		glow.widgets.Editor.Toolbar.Button.prototype.disable = function(name) {
			this.base.disable.apply(this, arguments);
		}

		

		/**
			@ignore
			@private
			@name enable_key_listener
			@description	Adds listener onto each button when it has focus.  Listens for a keyup event with the ENTER key.  This allows users to 'press' the button via the keyboard when the button has focus.
		 */
		function enable_key_listener(button) {

			return glow.events.addListener(glow.dom.get(document), 'keyup', function(event){
				if(event.key == 'ENTER') {
					button.press();
					if (event.preventDefault) event.preventDefault();
					return false;
				}
			});



		}

		/* built-in tools here. */		 
		// this is now called on each instance of editor
		function createTools(localeModule) {
			return {
				bold: {
					name : "bold",
					type : "button",
					opts : {
						title:      localeModule.BOLD_TITLE,
						label:      localeModule.BOLD_LABEL,
						tag:		"strong",
						command:    "bold",
						shortcut:   "b",
						action:     function() { tag.call(this.editor.editArea, this.command); return false; }
					}
				},
				italics: {
					name : "italics",
					type : "button",
					opts : {
						title:      localeModule.ITALICS_TITLE,
						label:      localeModule.ITALICS_LABEL,
						tag:		"em",
						command:    "italic",
						shortcut:   "i",
						action:     function() { tag.call(this.editor.editArea, this.command); return false; }
					}
				},
				strike: {
					name : "strike", 
					type : "button", 
					opts : {
						title:      localeModule.STRIKE_TITLE,
						label:      localeModule.STRIKE_LABEL,
						tag:		"strike",
						command:    "strikethrough",
						action:     function() { tag.call(this.editor.editArea, this.command); return false; }
					}
				},

 				/*blockquote: {
					name : "blockquote", 
					type : "button", 
					opts : {
						title:      localeModule.BLOCK_TITLE,
						label:      localeModule.BLOCK_LABEL,
						tag:		"formatblock",
						command:    "<h1>",
						action:     function() { tag.call(this.editor.editArea, this.tag, this.command); return false; }
					}
				},*/

				unorderedlist: {
					name : "unorderedlist",
					type : "button", 
					opts : {
						title:      localeModule.UNORDERED_TITLE,
						label:      localeModule.UNORDERED_LABEL,
						tag:		"ul",
						command:    "insertunorderedlist",
						action:     function() { tag.call(this.editor.editArea, this.command); return false; }
					}
				},
				orderedlist: {
					name : "orderedlist",
					type : "button", 
					opts : {
						title:      localeModule.ORDERED_TITLE,
						label:      localeModule.ORDERED_LABEL,
						tag:		"ol",
						command:    "insertorderedlist",
						action:     function() { tag.call(this.editor.editArea, this.command); return false; }
					}
				},
				formatBlock: {
					name : "formatBlock",
					type : "dropDown", 
					opts : {
						title:      localeModule.FORMATBLOCK_TITLE,
						label:      localeModule.FORMATBLOCK_LABEL,
						tag:		'h1|h2|h3|p',
						action: function() {
							tag.call(this.editor.editArea, "formatblock", "<" + this.overlayMenu.menuItems[this.overlayMenu.selected].tag + ">");
						},
						menuItems: [
							{
								title:      localeModule.HEADINGLEVELONE_TITLE,
								template:	'<li class="heading1">{title}</li>',
								tag:		'h1'

							},
							{
								title:      localeModule.HEADINGLEVELTWO_TITLE,
								template:	'<li class="heading2">{title}</li>',
								tag:		'h2'
							},
							{
								title:      localeModule.HEADINGLEVELTHREE_TITLE,
								template:	'<li class="heading3">{title}</li>',
								tag:		'h3'
							},
							{
								title:      localeModule.NORMAL_TITLE,
								template:	'<li class="normal">{title}</li>',
								tag:		'p',
								selected:	true
							}
						]
					}
				}
				/* tag.call(this.editor.editArea, this.command)
				,
				heading1:{
					name : "heading1", 
					opts : {
						title:      localeModule.HEADING1_TITLE,
						label:      localeModule.HEADING1_LABEL,
						tag:		"Heading1",
						command:    "formatblock",
						action:     function() { tag.call(this.editor.editArea, this.command, 'h1'); return false; }
					}
				},
				toggle: {
					name : "toggle", 
					opts : {
						title:      localeModule.TOGGLE_TITLE,
						label:      localeModule.TOGGLE_LABEL,
						tag:		"toggle",
						command:    "toggle",
						action:     function() { this.editor.editArea.toggle_designMode(); return false; }
					}
				} */
			};
		}

////////

		/**
			@ignore
			@private
			@constructor
			@name glow.widgets.Editor.EditArea
		 */
		glow.widgets.Editor.EditArea = function(editor, opts) {
			opts = opts || {};
			this.editor = editor;
			this.element = $(document.createElement("iframe"));
			this.element.attr('frameBorder', 0);
			this.element.src = "javascript:false";
			this.editor.element.get(".editor-state").append(this.element);
			var that = this;
			setTimeout(
				function() { // For FF
					that.element[0].contentWindow.document.designMode = "on";
					that.contentWindow = that.element[0].contentWindow;
	
					if (that.editor.textarea.val()) {
						that.contentWindow.document.write(that.editor.textarea.val());
					}
					else {
						that.contentWindow.document.write("<p>&nbsp;</p>");
					}
					that.contentWindow.document.close();
					that.editor.iframeFocus = false;
					addKeyboardListener.call(that);
					manageToolbarFocus(that);
					if (glow.env.ie || glow.env.opera) { //TODO: /sigh
						glow.dom.get(that.element[0].contentWindow.document).item(0).attachEvent('onclick', function() { updateArea.call(that); } );
						glow.dom.get(that.element[0].contentWindow.document).item(0).attachEvent('onkeyup', function() { updateArea.call(that); } );
						//glow.dom.get(that.element[0].contentWindow.document).item(0).attachEvent('onmouseup', function() { updateArea.call(that); });
						//events.addListener(that.element[0], 'focus', function () { updateArea.call(that); } );
						//events.addListener(that.element[0].contentWindow, 'blur', function () { updateArea.call(that); } );
					}
					else {
						events.addListener(that.contentWindow.document, 'blur', function () { updateArea.call(that); } );
						events.addListener(that.contentWindow, 'click', function () { updateArea.call(that); } );
						events.addListener(that.contentWindow, 'keyup', function () { updateArea.call(that); } );
					}
					if (glow.env.gecko) {
						that.contentWindow.document.execCommand("styleWithCSS", false, false);
					}
					
					// see Webkit bug related to onbeforeunload and iframes 
					// https://bugs.webkit.org/show_bug.cgi?id=21699
					// http://code.google.com/p/chromium/issues/detail?id=5773
					if (glow.env.webkit) {
						events.addListener(that.element[0].contentWindow, 'beforeunload', function () { that.editor.commit(); return true; } );
						events.addListener(window, 'beforeunload', function () { that.editor.commit(); return true; } );
					}
					
					// Give the toolbar one focusable button
					// Boolean that we use to make sure we only do this once
					that._toolbarInTabIndex = false;
					
					// Listener for when the user clicks on the editor
					glow.events.addListener(
						that.editor.element.get(".editor-state"),
						"click",
						function() {
							addToolbarIntoTabIndex.apply(that);
						},
						that
					);
					
					// Listener for when the user tabs into the iframe
					if (!isNaN(glow.env.ie)) {
						that.contentWindow.attachEvent(
							'onfocus',
							function() {
									addToolbarIntoTabIndex.apply(that);
							},
							that
						);
					}
					else {
						that.contentWindow.addEventListener(
							'focus',
							function() {
									addToolbarIntoTabIndex.apply(that);
							},
							that
						);
					}
	
					if (that.editor.bound) {
						that.idler = new Idler(
							that.contentWindow,
							["mousedown", "keypress"],
							350,
							{
								onFire: function() {
									that.editor._rinse();
								},
								rate: 700
							}
						);
					}
				},
				0
			)
		}

		/**
			@ignore
			@name addToolbarIntoTabIndex
			@description 
		 */
		function addToolbarIntoTabIndex() {
			if (this.editor._toolbarInTabIndex == true) return;
			this.editor.toolbar.element.get('a').item(0).tabIndex = 0;
			this.editor._toolbarInTabIndex = true;
		}

		/**
			@ignore
			@name addKeyboardListener
			@description
			@function
		 */
		function addKeyboardListener() {
			// If ie then use attachEvent with onkeydown
			if (!isNaN(glow.env.ie)) {
				glow.dom.get(this.contentWindow.document).item(0).attachEvent(
					'onkeydown',
					(function(that){
						return function(event){
							event = event || window.event;
							return checkingKeyCombos.call(that, event);
						}
					})(this)
				);
			}
			// If opera then use attachEvent with onkeypress
			else if (!isNaN(glow.env.opera)) {
				glow.dom.get(this.contentWindow.document).item(0).addEventListener(
					'keypress',
						(function(that){
							return function(event){
								event = event || window.event;
								return checkingKeyCombos.call(that, event);
							}
						})(this),
					true
				);
			}
			// Everything else use addEventListener with keydown
			else {

				glow.dom.get(this.contentWindow.document).item(0).addEventListener(
					'keydown', 
					(function(that){
						return function(event){
							event = event || window.event;
							return checkingKeyCombos.call(that, event);
						}
					})(this),
					true
				);
			}
		}

		/**
			@ignore
			@private
			@name checkingKeyCombos
			@description	Handles keyboard combinations
			@function
		 */
		function checkingKeyCombos(event) {

			// Safari on a mac is too screwy to be trusted with this change to tabbing so I'm filtering it out
			if ((navigator.platform.toLowerCase().indexOf('mac') == -1) || isNaN(glow.env.webkit))
			{
				// Set [TAB]+[SHIFT] to tab up the page
					if ((event.keyCode == 9) && (event.shiftKey == true)) {	//console.log('shift up');
						
						// If [TAB]+[SHIFT] then we want to set the focus to the tool in the toolbar that has been set to receive focus (see function 'manageToolbarFocus')
						var arrIcons = glow.dom.get(this.editor.element).get('ul.editor-toolbar-tools a');
						arrIcons.each(function(i) {
							if (arrIcons[i].tabIndex == 0) {
								window.focus(); // This forces the iframe to loose focus, otherwise we end up with two elements on the page responding to keyboard events
								arrIcons[i].focus();
							}
						});
						if (event.preventDefault) event.preventDefault();
						return false;
					}

				// Set [TAB] to tab down the page
					if ( (event.keyCode == 9) ) { //console.log('shift down');
						window.focus(); // This forces the iframe to loose focus, otherwise we end up with two elements on the page responding to keyboard events
						this.element[0].focus(); // This lets gecko loose focus on the iframe
						glow.dom.get(this.editor.element).get('p.endOfEditorCounter').item(0).focus(); // Send the focus to the last element in the editor (this is a paragraph that screen readers will see)
						if (event.preventDefault) event.preventDefault();
						return false;
					}
			}

			// [modifier] plus [toolbar shortcut] key
				if (appliedModifierKey.call(this, event)) {
					if
					(
						( this.editor.toolbar._shortcut(String.fromCharCode(event.keyCode).toLowerCase()) ) ||	// If toolbar shortcut is related to the key being pressed then it returns true
						( String.fromCharCode(event.keyCode).toLowerCase() == 'u' )								// Don't allow [modifier] + [i] (makes text underlined)
					)
					{
						if (event.preventDefault) event.preventDefault();
						return false;
					}
				}
			return true;
		}

		/**
			@ignore
			@private
			@name appliedModifierKey
			@description Returns boolean stating if the modifier key is being pressed
			@function
		 */
		function appliedModifierKey(event) {
			if (navigator.platform.toLowerCase().indexOf('mac') != -1) {
				if (!isNaN(glow.env.opera)) return event.ctrlKey;
				return event.metaKey;
			}
			else {
				return event.ctrlKey;
			}
		}

		/**
			@ignore
			@private
			@name isSafariTwo
			@description	Returns boolean if browser is Safari version 2
			@function
		 */
		function isSafariTwo() {
			if ((glow.env.webkit > 400) && (glow.env.webkit < 500)) {
				return true;
			}
			else {
				return false;
			}
		}

		/**
			@ignore
			@private
			@name moveCursorLeft
			@description	Gives the toolbar a single tabindex, allowing you to tab in and out of the toolbar with cycling through the buttons.  When the toolbar does have focus, move between buttons using the LEFT and RIGHT arrow keys.
		 */
		function manageToolbarFocus(editArea) {
			var left_listener,
				right_listener,
				arrButtons = editArea.editor.toolbar.element.get('a');


			// Add key event listeners whenever the 'buttons' the in the toolbar are in focus
			// NOTE: We could potential use event delegation but right now I'm not too sure
			// how this would work with the browser giving the element focus.
			// When the button has focus...
			glow.events.addListener(
				glow.dom.get(arrButtons),
				'focus',
				function() { // console.log('on');

					// ... swap focus to its siblings if the user presses the LEFT or RIGHT arrow keys
					right_listener = glow.events.addKeyListener('RIGHT', 'down', moveFocusRight);
					left_listener  = glow.events.addKeyListener('LEFT',  'down', moveFocusLeft);

				}
			);

			glow.events.addListener(
				glow.dom.get(arrButtons),
				'blur',
				function() { // console.log('off');

					glow.events.removeListener(right_listener);
					glow.events.removeListener(left_listener);

				}
			);
		}

		/**
			@ignore
			@private
			@name moveCursorLeft
			@description Receives left arrow key down event, passes the previous sibling of the element source to moveCursor function.
		 */
		function moveFocusLeft(event, siblingLinks) {
			moveFocus( getDistantSibling( glow.dom.get(event.source), -1, siblingLinks) );
		}

		/**
			@ignore
			@private
			@name moveCursorRight
			@description Receives right arrow key down event, passes the next sibling of the element source to moveCursor function.
		 */
		function moveFocusRight(event, siblingLinks) {
			moveFocus( getDistantSibling( glow.dom.get(event.source), 1, siblingLinks) );
		}

		/**
			@ignore
			@private
			@name getDistantSibling
			@description  Builds an array of the hyperlinks in the toolbar, sets all their tabIndexes to -1 and then returns either 
			              the next or previous element in the array based on the element passed in as a param
		 */
		function getDistantSibling(elm, move, arrLinks) { // console.log('changing the toolbar');
			arrLinks = arrLinks || getAncestor(glow.dom.get(elm), "ul").get('a');
			//arrLinks = arrLinks || glow.dom.get(elm).parent().parent().parent().get('a');
			
			//feedback(arrLinks.html());
			
			var itemIndexToFocus = 0,
				trueArrayLength  = (arrLinks.length-1);

			// Loop through array...
			arrLinks.each(function(y) {
				// If this item is the passed in element item, then set 'itemIndexTofocus'
				if (this == elm.item(0)) itemIndexToFocus = (y+move);
				// Reset tabIndex
				this.tabIndex = -1;
			});

			// Make sure 'itemIndexToFocus' stays within the bounds of the array length
			if (itemIndexToFocus < 0) itemIndexToFocus = 0;
			if (itemIndexToFocus > trueArrayLength) itemIndexToFocus = trueArrayLength;

			// Return either the next or previous item compared to the element passed in via 'elm' param
			return arrLinks.item(itemIndexToFocus);
		}

		function getAncestor(elm, typeToFind) {
			var x = false;
			while(x == false) {
				if (
					   (elm[0].nodeName.toUpperCase() == typeToFind.toUpperCase())
					|| (elm[0].nodeName == "HTML")
				) {
					x = true;
				}
				elm = elm.parent();
			}
			return elm;			
		}

		/**
			@ignore
			@private
			@name moveCursor
			@description Moves the focus from the focused element, to one of its siblings.  Also manages the tabindex of the toolbar
		 */
		function moveFocus(item) {

			if (typeof item != 'undefined') {
				// Set the tab index of the item that is to gain focus to 0 and give it focus.
				item.tabIndex = 0;
				item.focus();
			}
		}

		/**
			@ignore
			@private
			@name tag
			@description Applies execCommand 
			@function
		 */

		function tag(tagName, attr) { /*debug*///console && console.log("glow.widgets.Editor.EditArea.prototype.tag("+tagName+", "+attr+")");
			attr = attr || null;
			if (this[tagName + "_" + attr]) {
				this[tagName + "_" + attr]();
			}
			else {
				this._domPath();
				this.contentWindow.document.execCommand(tagName, false, attr);
			}
			this.contentWindow.focus();
			updateArea.call(this);
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea._getSelected
			@description gets the selected text
			@function
		 */
		glow.widgets.Editor.EditArea.prototype._getSelected = function() { 
			if (glow.env.ie) {
				// IE doesn't use the DOM2 methods for selection and determining range 
				return this.contentWindow.document.selection;
			}
			else {
				return this.contentWindow.getSelection();
			}
		}
		
		/**
			@ignore
			@private
			@name updateArea
			@description Commits the iframe content to the hidden textarea
			@function
		 */
		function updateArea() { /*debug*///console.log("updateArea()")
			this.editor.commit();
			// Update Toolbar
			var currentDomPath = this._domPath();
			if (currentDomPath && currentDomPath != this.editor._lastDomPath) {
				this.editor._lastDomPath = currentDomPath;
				var e = glow.events.fire(this, 'domPathChange', {
					domPath: currentDomPath
				});
				
				if (!e.defaultPrevented()) {
					this.editor.toolbar._update(currentDomPath);
				}
			}
		}
		
// 		glow.widgets.Editor.EditArea.prototype.formatblock_blockquote = function() {
// 			elmPath = this._domPath();
// 			currentTag = elmPath.split("|");
// 			if (currentTag[1] && currentTag[1].toUpperCase() == "BLOCKQUOTE") {
// 				if (glow.env.webkit) { // Webkit doesn't follow the blockquote spec requiring <p> elements
// 					this.contentWindow.document.execCommand("formatblock", false, "<p>");
// 				}
// 				else {
// 					this.contentWindow.document.execCommand("outdent", false, null);
// 					// Need to remove from IE generated code?
// 					// dir=ltr style="MARGIN-RIGHT: 0px"
// 					// style="MARGIN-RIGHT: 0px" dir=ltr
// 				}
// 			}
// 			else {
// 				if (glow.env.ie) { // IE incorrect applies a blockquote instead of an indent, which is good because it doesn't support formatblock(blockquote)
// 					this.contentWindow.document.execCommand("indent", false, null);
// 				}
// 				else if (glow.env.gecko <= 2) { // Oddly ff2 will accept almost any string and make it a new tag
// 					this.contentWindow.document.execCommand("formatblock", false, "blockquote");
// 				}
// 				else {
// 					this.contentWindow.document.execCommand("formatblock", false, "<blockquote>");
// 				}
// 			}
// 		}
		
		/* TODO: Use for later release...
		glow.widgets.Editor.EditArea.prototype.formatblock_h1 = function() {
			this.formatblock_heading("h1");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_h2 = function() {
			this.formatblock_heading("h2");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_h3 = function() {
			this.formatblock_heading("h3");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_h4 = function() {
			this.formatblock_heading("h4");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_h5 = function() {
			this.formatblock_heading("h5");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_h6 = function() {
			this.formatblock_heading("h6");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_p = function() {
			this.formatblock_heading("p");
		}
		glow.widgets.Editor.EditArea.prototype.formatblock_heading = function(lvl) {
			elmPath = this._domPath();
			currentTag = elmPath.split("|");
			if (currentTag[1].toUpperCase() == lvl.toUpperCase()) {
				this.contentWindow.document.execCommand("formatblock", false, "<p>");
			}
			else {
				this.contentWindow.document.execCommand("formatblock", false, "<"+lvl+">");
			}
		}
		glow.widgets.Editor.EditArea.prototype.toggleDesignMode = function() {
			if (this.contentWindow.document.designMode.toLowerCase() == "on") {
				if (glow.env.ie) { //IE resets the document, so...
					cntWin = glow.dom.get(this.editor.editArea.contentWindow.document).get('body').html();
					this.contentWindow.document.designMode = "off";
					this.editor.editArea.contentWindow.document.write(cntWin);
				}
				else {
					this.contentWindow.document.designMode = "off";
				}
			}
			else {
				this.contentWindow.document.designMode = "on";
			}
		} */
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_domPath
			@description
			@function
			@param {String} name
			@returns {glow.widgets.Editor.Toolbar.Tool}
		 */
		glow.widgets.Editor.EditArea.prototype._domPath = function(elm) {
			elm = elm || this._getSelectedNode();
			var elmBody = glow.dom.get(this.editor.editArea.contentWindow.document).get('body').item(0);
			var trail = "";
			
			if (elm === null) return null;
			
			while (elm.nodeName.toUpperCase() != elmBody.nodeName.toUpperCase()) {
				trail = '<' + elm.nodeName.toLowerCase() + ((elm.getAttribute('style'))? ' style="'+elm.getAttribute('style')+'"' : '') + '>' + trail;
				elm = elm.parentNode;
			}
			
			var cleanTrail = this.editor.cleaner.clean(trail);
			cleanTrail = cleanTrail.replace(/></g, "|").replace(/>/g, "|").replace(/</g, "|");
			cleanTrail = cleanTrail.replace(/\|\/[^\|]+\|/g, "|"); // collapse /named nodes that sometimes appear
			return cleanTrail;
		}

		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_getSelectedNode
			@description Returns the parent node of the selected text in the edit area
			@function
			@returns {HTML node}
		 */
		glow.widgets.Editor.EditArea.prototype._getSelectedNode = function() { 
			var selected = this._getSelected();
			
			if (!glow.env.ie) {
				if (selected && selected.rangeCount === 0) {
					return null; // selection is not in the editor, can't get any selected node!
				}
				selectedNode = selected.getRangeAt(0).commonAncestorContainer;
				if (selectedNode.nodeType === 3) {
					return selectedNode.parentNode;
				}
				else {
					return selectedNode;
				}
			}
			else { // ie 6
				return selected.createRange().parentElement();
			}
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_nodeAt
			@description Given a character offset, return the node that character is in.
			Useful for unit testing.
		 */
		glow.widgets.Editor.EditArea.prototype._nodeAt = function(location) {
			var w = this.contentWindow;
			var d = w.document;
			
			var counter = 0;
			var node = d.body;
			
			function walkNode(node, location) {
				if (node.nodeName == "#text") {
					counter += node.nodeValue.length;
					if (counter >= location) {					
						return node.parentNode;
					}
					
				}
				if (node.childNodes) {
					for (var i = 0; i < node.childNodes.length; i++) {
						var foundNode = walkNode(node.childNodes[i], location);
						if (foundNode) return foundNode;
					}
				}
			}
			
			var foundNode = walkNode(node, location);
			return foundNode;
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_getContent
			@description Get the entire contents of the editArea. This will be in the browser's native format.
		 */
		glow.widgets.Editor.EditArea.prototype._getContent = function() { /*debug*///console.log("glow.widgets.Editor.EditArea#_getContent()");
			return this.contentWindow.document.body.innerHTML;
		}
		
		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_setContent
			@description Set the entire contents of the editArea. This should be in the browser's native format.
		 */
		glow.widgets.Editor.EditArea.prototype._setContent = function(content) {
			this.contentWindow.document.body.innerHTML = content;
		}

		/**
			@ignore
			@private
			@name glow.widgets.Editor.EditArea#_select
			@description Select the entire contents of the editArea. Useful for unit testing.
		 */
		glow.widgets.Editor.EditArea.prototype._select = function() {
			var el = this.contentWindow;
			el.focus();

			if (glow.env.ie) { // ie, but not opera (faker)
				r = el.document.body.createTextRange();
				r.moveEnd('textedit');
				r.select();
			}
   			else { // moz, saf, opera
   				var r = el.document.createRange();
   				r.selectNodeContents(el.document.body.firstChild.childNodes[0]);
   				
   				var s = el.getSelection();
   				s.removeAllRanges();
   				el.getSelection().addRange(r);
			}
		}
	}
});

(window.gloader || glow).module({
	name: "glow.widgets.Timetable",
	library: ["glow", "1.7.0"],
	depends: [[
		"glow", "1.7.0",
		'glow.dom',
		'glow.events',
		'glow.widgets',
		'glow.widgets.Slider',
		'glow.dragdrop',
		'glow.i18n'
	]],
	builder: function(glow) {
		var $dom = glow.dom,
			$ = $dom.get,
			$create = $dom.create,
			$events = glow.events,
			$listen = $events.addListener,
			$fire = $events.fire,
			$lang = glow.lang,
			$apply = $lang.apply,
			$i18n = glow.i18n,
			idIndex = 0,
			vocabs = [
				{
					length: "width",
					breadth: "height",
					rootClass: "glow170-Timetable",
					dragAxis: "x",
					pos: "left",
					posOpposite: "right",
					otherPos: "top",
					otherPosOpposite: "bottom"

				},
				{
					length: "height",
					breadth: "width",
					rootClass: "glow170-vTimetable",
					dragAxis: "y",
					pos: "top",
					posOpposite: "bottom",
					otherPos: "left",
					otherPosOpposite: "right"
				}
			];

		$i18n.addLocaleModule("GLOW_WIDGETS_TIMETABLE", "en", {
			ACCESSIBILITY_MENU_START : "Start",
			ACCESSIBILITY_MENU_END : "End",
			ACCESSIBILITY_INTRO : "Use this menu to choose what section of the timetable to view.",
			SKIPLINK_TO_TRACK : "skip to track data",
			SKIPLINK_BACK_TO_HEADERS : "back to track headers"
		});

		function getId() {
			return glow.UID + "TimetableWidget" + (idIndex++);
		}

		/*
		  This returns either the horizontal or vertical vocab.
		*/
		function getVocab() {
			return vocabs[!!this._opts.vertical * 1];
		}

		// Helper for banding iterations
		function _adder(amount) {
			return function (prev) {
				if(prev instanceof Date) {
					return new Date(prev.getTime() + amount);
				} else {
					return prev + amount;
				}
			};
		}

		// type is "hour", "day", "week", "month" a function (which will just be returned) or a number
		// TODO - stop using this directly and roll it into _getSegments?? ()
		function _createIncrementer(type) {
			switch(type) {
				case "am/pm":
					return _adder(43200000); // 12 * 60 * 60 * 1000
				case "hour":
					return _adder(3600000); // 60 * 60 * 1000
				case "day":
					return _adder(86400000); // 24 * 60 * 60 * 1000
				case "week":
					return _adder(604800000); // 7 * 24 * 60 * 60 * 1000
				case "month":
					return function(prev)
					{
						var d = new Date(prev);
						d.setMonth(d.getMonth() + 1);
						return d;
					};
				case "year":
					return function(prev)
					{
						var d = new Date(prev);
						d.setFullYear(d.getFullYear() + 1);
						return d;
					};
				default:
					if (type instanceof Function) {
						return type;
					} else if (isNaN(type)) {
						throw new Error("Can't create incrementer");
					} else {
						return _adder(parseInt(type));
					}
			}
		}

		function _getSegments(rule, first, start, stop) {
			if(rule instanceof Array) { // use it directly
				if (!this.numerical) {
					// make sure all the values are dates
					return glow.lang.map(rule, function(item) {
						return new Date(item);
					})
				}
				return rule;
			}

			var iSize, output, sizes,
				now,
				len = 1,
				incrementer = _createIncrementer(rule);

			if(first == "auto") {
				sizes = {
					"am/pm"	: 43200000, // 12 * 60 * 60 * 1000
					"hour" 	:  3600000, //      60 * 60 * 1000
					"day" 	: 86400000  // 24 * 60 * 60 * 1000
				};

				switch (rule) {
					case "am/pm":
					case "hour":
					case "day":
						now = new Date(sizes[rule] * Math.floor(start.valueOf() / sizes[rule]));
						break;
					case "week":
						now = new Date(start);
						now.setHours(0, 0, 0, 0);
						now.setDate(now.getDate() - now.getDay());
						break;
					case "month":
						now = new Date(start);
						now.setHours(0, 0, 0, 0);
						now.setDate(1);
						break;
					case "year":
						now = new Date(start);
						now.setHours(0, 0, 0, 0);
						now.setMonth(0, 1);
						break;
					default:
						now = start;
				}
			} else {
				now = first || start;
			}

			output = [now];

			while(now < stop)
			{
				now = incrementer(now);
				output[len++] = now;
			}

			return output;
		}

		// for building track header/footer, item, scale segment and scrollbar mark contents from a template
		function _buildFromTemplate(template) {
			var halfway, content;

			if (template == undefined) {
				return null;
			}

			if(template instanceof $dom.NodeList) {
				halfway = template;
			} else if(template instanceof Function) {
				halfway = template(this);
			} else {
				halfway = $lang.interpolate("" + template, this);
			}

			if(halfway instanceof $dom.NodeList) {
				content = $dom.create("<div></div>").append(halfway);
			} else {
				content = $dom.create("<div>" + halfway + "</div>");
			}

			return content;
		}

		/**
		@name glow.widgets.Timetable
		@class
		@description A scrollable list of ordered items displayed against a proportional axis.
			Note: you must call draw() on a timetable before it is displayed.

			<div class="info">Widgets must be called in a <code>glow.ready()</code> call.</div>

		@param {String|HTMLElement|glow.dom.NodeList} container The Element into which the Timetable will be placed.
			If a String is given, it is used as a selector. If a Nodelist is given, the first item is used.

			The contents of the element will be replaced by the Timetable. Ideally, this element should contain
			a static version of the timetable for users without JavaScript.
		@param {Date | Number} start The start point of the entire Timetable.
			The user will not be able to scroll before this point.

			Also controls the unit of the Timetable. If a Number is given, the Timetable is regarded as number based, otherwise it's regarded as Date based
		@param {Date | Number} end The end point of the entire Timetable
			The user will not be able to scroll beyond this point.
		@param {Date | Number} viewStart The start point of the visible area.
			This sets the start point of the view, and in conjunction with viewEnd sets the zoom level of the timetable
		@param {Date | Number} viewEnd The end point of the visible portion.
			In conjunction with viewStart sets the zoom level of the timetable
		@param {Object} [opts] An optional options object
			@param {String} [opts.theme="light"] Visual theme for the Timetable.
				Possible values are "light" and "dark". Both themes can be altered with
				CSS to fit the design of your site.
			@param {String} [opts.id=auto-generated] An id for the Timetable.
				You must set this (or className) if you're going to customise the design
				of the timetable, to target it with CSS selectors.
			@param {String} [opts.className] A class name for the Timetable's container element
				You must set this (or id) if you're going to customise the design
				of the timetable, to target it with CSS selectors.
			@param {Boolean} [opts.vertical=true] Create a vertical Timetable?
			@param {String | Number} [opts.size=container size] The width (if horizontal) or height (if vertical) of the scrollable area of the Timetable.
				Note that headers and footers will add to the overall size.
			@param {Array} [opts.tracks] An array of Tracks to create the Timetable with.
				Each element in the Array is an Array of parameters that are passed to the addTrack method.

				This can be used to pass in timetable data as a single JSON object rather than using the addTrack and
				addItem methods.
			@param {Boolean} [opts.collapseItemBorders=true] Should item borders collapse into each other?
				As in, take up the same space.
			@param {Boolean} [opts.collapseTrackBorders=false] Should track borders collapse into each other?
				As in, take up the same space. This must be false if you want your tracks to be separated by a margin.
			@param {Boolean} [opts.keepItemContentInView=true] Should the content of an item that is partially in view be moved into view?
			@param {String | glow.dom.NodeList | Function} [opts.itemTemplate] Template for each Item on a Track in the Timetable
				The {@link glow.widgets.Timetable.Item item} will be passed into the template.
			
				<p>A default template is used if this is not provided, which displays just the item title</p>
				<ul>
					<li>If a String is provided, it is passed through glow.lang.interpolate, with the Item as the data parameter, and the output is used.</li>
					<li>If a NodeList is provided it is used directly.</li>
					<li>If a function is provided it should take the Item as its only argument, and return the HTML or a NodeList to use.</li>
				</ul>
			@param {String | glow.dom.NodeList | Function} [opts.trackHeader] Template for the header section the each Track in the Timetable
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
			
				Defaults to no header.
				See itemTemplate above for a description of how the different values are treated.
			@param {String | glow.dom.NodeList | Function} [opts.trackFooter] Template for the footer section the each Track in the Timetable
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
				
				Defaults to no footer.
				See itemTemplate above for a description of how the different values are treated.
			@param {Function} [opts.onChange] Event shortcut
			@param {Function} [opts.onItemClick] Event shortcut
			@param {Function} [opts.onMoveStart] Event shortcut
			@param {Function} [opts.onMoveStop] Event shortcut

		@example
			// using dates
			var myTimetable = new glow.widgets.Timetable('#timetableContainer',
				"31 December 2008 23:30", "1 January 2009 14:30",
				"1 January 2009 00:30", "1 January 2009 05:30",
				{
					itemTemplate: "<strong>{title} # {id}</strong>",
					trackHeader: "<h2>{title}</h2>",
				}
			)

			// using numbers
			var myTimetable = new glow.widgets.Timetable('#timetableContainer',
				0, 100,
				5, 6,
				{
					itemTemplate: "<strong>{title} # {id}</strong>",
					trackHeader: "<h2>{title}</h2>",
				}
			)

		@see <a href="../furtherinfo/widgets/timetable/">Timetable user guide</a>
		@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
		@see <a href="../furtherinfo/widgets/timetable/styling.shtml">Styling a Timetable</a>
		@see <a href="../furtherinfo/widgets/timetable/remotedata.shtml">Loading Timetable Data From A Remote Source</a>

		*/
		/**
		@name glow.widgets.Timetable#event:change
		@event
		@description Fires each time the Timetable view start point changes.

			This will fire after dragging, rather than during dragging.
		
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.Timetable#event:itemClick
		@event
		@description Fires when the user clicks an item on the Timetable.

			The Event object will have an 'item' property.
		
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.Timetable#event:moveStart
		@event
		@description Fires when the Timetable starts to move (by whatever UI method).
		@param {glow.events.Event} event Event Object
		*/
		/**
		@name glow.widgets.Timetable#event:moveStop
		@event
		@description Fires when the Timetable stops moving (by whatever UI method).
		@param {glow.events.Event} event Event Object
		*/
		
		function Timetable(container, start, end, viewStart, viewEnd, opts) {

			this._opts = opts = $apply({
				vertical: true,
				tracks: [],
				collapseItemBorders: true,
				collapseTrackBorders: false,
				keepItemContentInView: true,
				className: "",
				theme: "light"
			}, opts || {});

			var vocab = getVocab.call(this);

			this._container = $(container);

			if (!this._container[0]) {
				throw new Error("Could not find container for Timetable");
			}

			/**
			@name glow.widgets.Timetable#id
			@type String
			@description The Timetable's id
			*/
			this.id = opts.id || getId();

			/**
			@name glow.widgets.Timetable#size
			@type Number
			@description The width (if horizontal) or height (if vertical) of the Timetable's scrollable arae
			*/
			this.size = opts.size || this._container[vocab.length]();

			/**
			@name glow.widgets.Timetable#numerical
			@type Boolean
			@description true if the Timetable is Number based, false if it is Date based
			*/
			this.numerical = ((typeof start) == "number");

			/**
			@name glow.widgets.Timetable#start
			@type Date | Number
			@description The start point of the whole Timetable.
				The user will not be able to scroll before this point.
			*/
			this.start = start;

			/**
			@name glow.widgets.Timetable#end
			@type Date | Number
			@description The end point of the whole Timetable
				The user will not be able to scroll beyond this point.
			*/
			this.end = end;

			/**
			@name glow.widgets.Timetable#_viewStart
			@private
			@type Date | Number
			@description The start point of the visible portion
			*/
			this._viewStart = viewStart;

			/**
			@name glow.widgets.Timetable#_viewEnd
			@private
			@type Date | Number
			@description The end point of the visible portion
			*/
			this._viewEnd = viewEnd;

			if(!this.numerical) {
				this.start = new Date(start);
				this.end = new Date(end);
				this._viewStart = new Date(viewStart);
				this._viewEnd = new Date(viewEnd);
			}

			this._viewWindowSize = this._viewEnd - this._viewStart;



			/**
			@name glow.widgets.Timetable#tracks
			@type glow.widgets.Timetable.Track[]
			@description Array of all the Tracks in the Timetable (including disabled ones).
				Ordered by the order they were added.
			*/
			this.tracks = [];

			for(var i = 0, l = opts.tracks.length; i < l; i++) {
				this.addTrack.apply(this, opts.tracks[i]);
			}

			if(opts.onChange) {
				$listen(this, "change", opts.onChange);
			}
			if(opts.onItemClick) {
				$listen(this, "itemClick", opts.onItemClick);
			}
			if(opts.onMoveStart) {
				$listen(this, "moveStart", opts.onMoveStart);
			}
			if(opts.onMoveStop) {
				$listen(this, "moveStop", opts.onMoveStop);
			}

			/**
			@name glow.widgets.Timetable#element
			@type glow.dom.NodeList
			@description The root element of the Timetable widget
			*/
			this.element;

			// create view
			this._view = new View(this);

			/**
			@name glow.widgets.Timetable#_banding
			@private
			@type Number[] | Date[]
			@description The banding of the Timetable, as an array of banding interval boundary points. An empty array signifies no banding.
			*/
			this._banding = [];

			/**
			@name glow.widgets.Timetable#_primaryScales
			@private
			@type Object[]
			@description The top/left scales of the Timetable, as an array of objects, each containg an array of segment end points ("points" property), the size of the scale ("size" property) and a String/function/Nodelist template ("template" property). An empty array signifies no primary scale.
				ie it will end up looking a bit like this [{template: "{start} to {end}", points: [0, 1, 2, 3]}, ...]
			*/
			this._primaryScales = [];

			/**
			@name glow.widgets.Timetable#_secondaryScales
			@private
			@type Object[]
			@description The bottom/right scales of the Timetable, just like _primaryScales.
			*/
			this._secondaryScales = [];

			/**
			@name glow.widgets.Timetable#_primaryScrollbar
			@private
			@type Object
			@description The top/left scrollbar of the Timetable, as an object containg an array of mark points ("points" property), the size of the scrollbar ("size" property) and a String/function/Nodelist template ("template" property). An null object signifies no primary scrollbar.
				ie it will end up looking a bit like this [{template: "{start} to {end}", points: [0, 1, 2, 3]}, ...]
			*/
			this._primaryScrollbar = null;

			/**
			@name glow.widgets.Timetable#_secondaryScrollbar
			@private
			@type Object[]
			@description The bottom/right scrollbar of the Timetable, just like _primaryScrollbar.
			*/
			this._secondaryScrollbar = null;
		}

		Timetable.prototype = {
			/**
			@name glow.widgets.Timetable#addTrack
			@function
			@description Factory method for creating a standard Track and adding it to the Timetable.
				Tracks can only created by using this method.

			@param {String} title The title of the Track
			@param {String | Number} size The height (if horizontal) or width (if vertical) of the Track (not including borders and margins)
			@param {Object} [opts] Options object
				@param {String} [opts.id=auto-generated] An id for the Track
				@param {String} [opts.className] A class name for the Track's container element
				@param {String | glow.dom.NodeList | Function} [opts.itemTemplate] Template for each Item on this Track.
					The {@link glow.widgets.Timetable.Item item} will be passed into the template.
					
					<ol>
						<li>If a String is provided, it is passed through glow.lang.interpolate, with the Item as the other parameter, and the output is used.</li>
						<li>If a NodeList is provided it is used directly.</li>
						<li>If a function is provided it should take the Item as its only argument, and return the HTML or a NodeList to use.</li>
					</ol>
				@param {String | glow.dom.NodeList | Function} [opts.trackHeader] Template for the header section the this Track.
					The {@link glow.widgets.Timetable.Track track} will be passed into the template.
					
					Overrides any template specified at Timetable level.
					
					See itemTemplate above for a description of how the different values are treated.
				@param {String | glow.dom.NodeList | Function} [opts.trackFooter] Template for the footer section the this Track.
					The {@link glow.widgets.Timetable.Track track} will be passed into the template.
					
					Overrides any template specified at Timetable level.
					
					See itemTemplate above for a description of how the different values are treated.
				@param {Object} [opts.data] An object of arbitrary data to be attached to the Track.
				@param {Boolean} [opts.disabled=false] A disabled track is not rendered in the view
				@param {Array} [opts.items] An array of Items to create the Track with
					Each element in the Array is an Array of parameters that are passed to the addItem method of the Track

			@returns {glow.widgets.Timetable.Track} The Track that was created

			@example
				// no items
				var myTrack1 = myTimetable.addTrack("Track 1", 250);

				// add some items at the same time
				var myTrack2 = myTimetable.addTrack("Track 2", 250, {
					items : [
						["Item 1", "2009/01/01 00:00", "2009/01/01 01:00"],
						["Item 2", "2009/01/01 01:00", "2009/01/01 01:30"],
						["Item 3", "2009/01/01 01:30", "2009/01/01 01:40"]
					]
				});

				// add additional items
				myTrack2.addItem("Item 4", "2009/01/01 01:40", "2009/01/01 02:00");

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>

			*/
			addTrack : function(title, size, opts) {
				return this.tracks[this.tracks.length] = new Track(this, title, size, opts);
			},

			/**
			@name glow.widgets.Timetable#currentPosition
			@function
			@description Gets or sets the start point of the Timetable's visible portion

			@param {Date | Number} value The new start point to use

			@returns this
			*/
			currentPosition : function(value) {
				if(value === undefined) {
					var current = (this._view) ? this._view.currentPosition() : this._viewStart;
					// convert it to a date if we have to
					if (!this.numerical) {
						current = new Date(current);
					}
					return current;
				} else {

					if (!this.numerical) {
						value = new Date(value);
					}



					this._view.currentPosition(value);

					return this;
				}
			},

			/**
			@name glow.widgets.Timetable#viewRange
			@function
			@description Get or set the visible data range.
				Changing this changes the scale of the timetable, you can use
				this to 'zoom' the view in or out.

			@param {Object} [newRange] An object with 'start' and / or 'end' properties, in the same format as the viewStart and viewEnd constructor parameters.
				If either the 'start' or 'end' property is omitted, the current value is taken.

			@returns this (if setting) or Object with start & end properties representing the view range

			@example
				// function to zoom in a timetable
				function zoomIn(timetable) {
				  // get the current range
				  var range = timetable.viewRange();
				  // get the difference between the start and end values
				  var currentDiff = range.end - range.start;
				  // half the difference, this is a 2x zoom
				  var newDiff = currentDiff / 2;

				  // set a new end value for the range
				  timetable.viewRange({
				    end: range.start.valueOf() + newDiff
				  })
				}
			*/
			viewRange: function(newRange) {
				// start by getting the current range
				var duration = this._viewEnd - this._viewStart,
					currentPos = this.currentPosition(),
					range = {
						start: currentPos,
						end: currentPos.valueOf() + duration
					};

				if (!this.numerical) {
					range.end = new Date( range.end );
				}

				if (newRange) { // setting
					this._viewStart = newRange.start || range.start;
					this._viewEnd = newRange.end || range.end;

					if (!this.numerical) {
						this._viewStart = new Date( this._viewStart );
						this._viewEnd = new Date( this._viewEnd );
					}
					// make sure the values aren't out of range
					if (this._viewStart < this.start) {
						this._viewStart = this.start;
					}
					if (this._viewEnd > this.end) {
						this._viewEnd = this.end;
					}
					if (this._view && this._view._drawn) {
						this.draw(true).currentPosition(this._viewStart);
					}
					return this;
				} else { // getting
					return range;
				}
			},

			/**
			@name glow.widgets.Timetable#setItemTemplate
			@function
			@description Sets the Default Item template for the Timetable
				The {@link glow.widgets.Timetable.Item item} will be passed into the template.
			@param {String | glow.dom.NodeList | function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setItemTemplate : function(template) {
				this._opts.itemTemplate = template;

				return this;
			},

			/**
			@name glow.widgets.Timetable#setTrackHeaderTemplate
			@function
			@description Sets the default Track header template for the Timetable
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
			@param {String | glow.dom.NodeList | Function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setTrackHeaderTemplate : function(template) {
				this._opts.trackHeader = template;
				return this;
			},

			/**
			@name glow.widgets.Timetable#setTrackFooterTemplate
			@function
			@description Sets the default Track footer template for the Timetable
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
			@param {String | glow.dom.NodeList | Function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setTrackFooterTemplate : function(template) {
				this._opts.trackFooter = template;
				return this;
			},

			/**
			@name glow.widgets.Timetable#setBanding
			@function
			@description Sets the background banding for the Timetable.
				Note that banding won't appear until the Timetable has been {@link glow.widgets.Timetable#draw redrawn}.
			@param {Number | String | function | Array} banding Defines the banding intervals
				<ul>
					<li>If a number is passed, banding intervals are defined that far apart. If the Timetable is date based, this should be a number of milliseconds.</li>
					<li>If a String is passed, it should be one of "am/pm", "hour", "day", "week", "month" or "year", as shortcuts for common (not necessarily even) time intervals.</li>
					<li>If a function is passed, it should take a point on the Timetable as its only argument and return the next point. It will be used to iteratively generate the banding interval points starting from the first.</li>
					<li>If an Array is passed, its elements should be points on the Timetable, and these will be used directly as the banding interval end points. The start option below will have no effect.</li>
				</ul>
			@param {Object} [opts] Options object
				@param {String | Date | Number} [opts.start=auto] The start point of the first banding interval.
					<p>If set to auto, an appropriate choice is made for the banding.</p>
					<ul>
						<li>"am/pm" chooses 12am or 12pm.</li>
						<li>"hour" gives the beginning of the hour</li>
						<li>"day" gives midnight</li>
						<li>"week" gives midnight on sunday</li>
						<li>"month" gives midnight on the first</li>
						<li>"year" gives midnight on January 1st</li>
					</ul>
					<p>For any other banding definition, auto sets the start to the Timetable start point.</p>
					<p>Has no effect if an Array is passed as the banding.</p>

			@returns this

			@example
				myTimetable.setBanding("hour");
			*/
			setBanding : function(banding, opts) {
				var options = opts || {};

				this._banding = _getSegments.call(this, banding, options.start || "auto", this.start, this.end);

				return this;
			},

			/**
			@name glow.widgets.Timetable#addScale
			@function
			@description Adds a scale to one or both sides of the Timetable.
				Several scales can be attached to either side of the Timetable - eg hours and "am/pm".

				Scales will appear in the order in which they were added, working inwards. ie the last to be added will be closest to the Tracks.

				Note that scales won't appear until the Timetable has been {@link glow.widgets.Timetable#draw redrawn}.

			@param {Number | String | function | Array} segmentation Defines the size of the scale's segments
				<ul>
					<li>If a number is passed, scale segments are defined that size. If the Timetable is date based, this should be a number of milliseconds.</li>
					<li>If a String is passed, it should be one of "am/pm", "hour", "day", "week", "month" or "year", as shortcuts for common (not necessarily even) time intervals.</li>
					<li>If a function is passed, it should take a point on the Timetable as its only argument and return another point. It will be used to iteratively generate the scale segment end points starting from the first.</li>
					<li>If an Array is passed, its elements should be points on the Timetable, and these will be used directly as the scale segment end points. The start option below will have no effect.</li>
				</ul>
			@param {String} [position] "top", "bottom", "left", "right" or "both" to determine where the scale should display.
				<ul>
					<li>"top" and "left" are synonymous, and positions the scale above a horizontal timetable or to the left of a vertical one.</li>
					<li>"bottom" and "right" are synonymous, and positions the scale below a horizontal timetable or to the right of a vertical one.</li>
					<li>"both" positions two identical scales, one in each position.</li>
					<li>If more than one scale is added on the same side of the timetable, they will display in the order they were added on the top/left and in the reverse order on the bottom/right.</li>
				</ul>
			@param {String | Number} size The height (if horizontal) or width (if vertical) of the scale
			@param {Object} [opts] Options object
				@param {String} [opts.id] An id for the scale's container element. Do not use this if adding a scale to both sides, or an error will be thrown (use className instead).
				@param {String} [opts.className] A class name for the scale's container element
				@param {String | glow.dom.NodeList | Function} [opts.template] Specification for templating HTML of each section of the scale
					<p>The template uses an object giving the segments "start" and "end" points.</p>
					<ul>
						<li>If a String is provided, it is passed through glow.lang.interpolate, with the above scale segment data object as the other parameter, and the output is used.</li>
						<li>If a NodeList is provided it is used directly.</li>
						<li>If a function is provided it should take the above scale segment data object as its argument, and return a String or a NodeList to use.</li>
						<li>If the final output of the template is a String, it need not contain any HTML (eg just a time of day, like "8am" is OK).</li>
						<li>If no template is supplied the scale segments will be empty.</li>
					</ul>
				@param {String | Date | Number} [opts.start=auto] The start point of the first scale segments.
					<p>If set to auto, an appropriate choice is made for the start point.</p>
					<ul>
						<li>"am/pm" chooses 12am or 12pm</li>
						<li>"hour" gives the beginning of the hour</li>
						<li>"day" gives midnight</li>
						<li>"week" gives midnight on sunday</li>
						<li>"month" gives midnight on the first</li>
						<li>"year" gives midnight on January 1st</li>
					</ul>
					<p>For any other segmentation definition, auto sets the start to the Timetable start point.</p>
					<p>Has no effect if an Array is passed as the interval.</p>

			@returns this

			@example
				myTimetable.addScale("hour", "left", 50, {
				  template: function (segment) {
				    return segment.start.getHours();
				  }
				});

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>

			*/
			addScale : function(segmentation, position, size, opts) {
				var options = opts || {},
					spec = {
						template: options.template,
						size: size,
						points: _getSegments.call(this, segmentation, options.start || "auto", this.start, this.end),
						opts: options
					};

				position = position.toLowerCase();

				if ((position == "both") && options.id) {
					throw new Error("Cannot apply an id when adding to both sides of the timetable");
				}

				if((position == "top") || (position == "left") || (position == "both")) {
					this._primaryScales[this._primaryScales.length] = spec;
				}

				if((position == "bottom") || (position == "right") || (position == "both")) {
					this._secondaryScales[this._secondaryScales.length] = spec;
				}

				return this;
			},

			/**
			@name glow.widgets.Timetable#removeScales
			@function
			@description Removes all the scales from one or both sides of the Timetable.
				Note that scales won't disappear until the Timetable has been {@link glow.widgets.Timetable#draw redrawn}.

			@param {String} [position] "top", "bottom", "left", "right" or "both" to determine which scales to remove.
				<ul>
					<li>"top" and "left" are synonymous, and removes the scales above a horizontal timetable or to the left of a vertical one.</li>
					<li>"bottom" and "right" are synonymous, and removes the scales below a horizontal timetable or to the right of a vertical one.</li>
					<li>"both" all the scales.</li>
				</ul>

			*/
			removeScales: function(position) {
				if((position == "top") || (position == "left") || (position == "both")) {
					this._primaryScales = [];
				}

				if((position == "bottom") || (position == "right") || (position == "both")) {
					this._secondaryScales = [];
				}

				return this;
			},

			/**
			@name glow.widgets.Timetable#addScrollbar
			@function
			@description Adds a scrollbar to one or both sides of the Timetable
				Only one scrollbar can be attached to either side of the Timetable, if more than one are added, the last one is used.

				Note that scrollbars won't appear until the Timetable has been {@link glow.widgets.Timetable#draw redrawn}.
			@param {Number | String | function | Array} marks Defines the scrollbar's mark points
				<ul>
					<li>If a number is passed, mark points are defined that far apart. If the Timetable is date based, this should be a number of milliseconds.</li>
					<li>If a String is passed, it should be one of "am/pm", "hour", "day", "week", "month" or "year", as shortcuts for common (not necessarily even) time intervals.</li>
					<li>If a function is passed, it should take a point on the Timetable as its only argument and return the next point. It will be used to iteratively generate the mark points starting from the first.</li>
					<li>If an Array is passed, its elements should be points on the Timetable, and these will be used directly as the mark points. The start option below will have no effect.</li>
				</ul>
			@param {String} [position] "top", "bottom", "left", "right" or "both" to determine where the scale should display
				<ul>
					<li>"top" and "left" are synonymous, and positions the scrollbar above a horizontal timetable or to the left of a vertical one.</li>
					<li>"bottom" and "right" are synonymous, and positions the scrollbar below a horizontal timetable or to the right of a vertical one.</li>
					<li>"both" positions two identical scrollbar, one in each position.</li>
				</ul>
			@param {String | Number} size The height (if horizontal) or width (if vertical) of the scrollbar
			@param {Object} [opts] Options object
				@param {String} [opts.id] An id for the scrollbar container element. Do not use this if adding a scrollbar to both sides, or an errro will be thrown.
				@param {String} [opts.className] A class name for the scrollbar's container element
				@param {String | glow.dom.NodeList | Function} [opts.template] Specification for templating HTML of each mark point
					<p>The template uses an object giving the mark's "start" and "end" points.</p>
					<ul>
						<li>If a String is provided, it is passed through glow.lang.interpolate, with the above data object as the other parameter, and the output is used.</li>
						<li>If a NodeList is provided it is used directly.</li>
						<li>If a function is provided it should take the above data object as its argument, and return a String or a NodeList to use.</li>
						<li>If the final output of the template is a String, it need not contain any HTML (eg just a time of day, like "8am" is OK).</li>
						<li>If no template is supplied the scale segments will be empty.</li>
					</ul>
				@param {String | Date | Number} [opts.start=auto] The first mark point.
					<p>If set to auto, an appropriate choice is made for the start point.</p>
					<ul>
						<li>"am/pm" chooses 12am or 12pm</li>
						<li>"hour" gives the beginning of the hour</li>
						<li>"day" gives midnight</li>
						<li>"week" gives midnight on sunday</li>
						<li>"month" gives midnight on the first</li>
						<li>"year" gives midnight on January 1st</li>
					</ul>
					<p>Has no effect if an Array is passed as the marks.</p>

			@returns this

			@example
				myTimetable.addScrollbar("hour", "left", 50, {
				  template: function (segment) {
				    return segment.start.getHours();
				  }
				});

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>

			*/
			addScrollbar : function(marks, position, size, opts) {
				var options = $apply({
						buttons: true
					}, opts || {}),
					spec = {
						template: options.template,
						size: size,
						points: _getSegments.call(this, marks, options.start || "auto", this.start, this.end),
						opts: options
					};

				position = position.toLowerCase();

				if ((position == "both") && options.id) {
					throw new Error("Cannot apply an id when adding to both sides of the timetable");
				}

				if((position == "top") || (position == "left") || (position == "both")) {
					this._primaryScrollbar = spec;
				}

				if((position == "bottom") || (position == "right") || (position == "both")) {
					this._secondaryScrollbar = spec;
				}

				return this;
			},

			/**
			@name glow.widgets.Timetable#draw
			@function
			@description Update the view with any changes you've made.
				You need to call this function after adding new tracks or items
				to make them visible on the timetable.

			@param {Boolean} [redraw=false] Redraw all items?
				Usually, draw will just draw items & tracks that have been added since
				last calling draw. Use this option to force the timetable to
				completely redraw.

			@returns this
			*/
			draw: function(redraw) {
				this._view.draw(redraw);
				return this;
			}
		};


		/**
		@name glow.widgets.Timetable.Track
		@class
		@description A Track is a grouping of Timetable items.

		@glowPrivateConstructor A Track cannot be directly instantiated. Instead the {@link glow.widgets.Timetable#addTrack addTrack} method of glow.widgets.Timetable must be used.
		*/
		function Track(timetable, title, size, opts) {
			this._opts = opts = $apply({
				className: ""
			}, opts || {});

			/**
			@name glow.widgets.Timetable.Track#disabled
			@type Boolean
			@description Should the Track be removed from the view?
				If set to true, this Track will not be rendered in the Timetable view the next time it is {@link glow.widgets.Timetable#draw drawn/redrawn}
			*/
			this.disabled = opts.disabled || false;

			/**
			@name glow.widgets.Timetable.Track#data
			@type Object
			@description The track's arbitrary data store
			*/
			this.data = opts.data || {};

			/**
			@name glow.widgets.Timetable.Track#title
			@type String
			@description The Track's title
			*/
			this.title = title;

			/**
			@name glow.widgets.Timetable.Track#size
			@type Number
			@description The Track's size
			*/
			this.size = size;

			/**
			@name glow.widgets.Timetable.Track#timetable
			@type glow.widgets.Timetable
			@description The Track's parent Timetable
			*/
			this.timetable = timetable;

			/**
			@name glow.widgets.Timetable.Track#id
			@type String
			@description The Track's id
			*/
			this.id = opts.id || getId();

			/**
			@name glow.widgets.Timetable.Track#items
			@type Item[]
			@description an array of the Track's Items in order of their start time
			*/
			this.items = [];

			if(opts.items != undefined) {
				for(var i = 0, l = opts.items.length; i < l; i++) {
					_factoryItem.apply(this, opts.items[i]);
				}

				_sortItems.call(this);
			}
		}

		// create an Item and add it to the Track
		function _factoryItem (title, start, end, options) {
			return this.items[this.items.length] = new Item(this, title, start, end, options);
		}

		function _itemSortOrder(a, b) {
			return ((a.start - b.start) || (a._addIndex - b._addIndex)); // _addIndexes will *never* be equal so this function will never return 0, meaning the sort is always stable.
		}

		// factorised out because it may become more complex in the future
		function _sortItems() {
			this.items.sort(_itemSortOrder);
		}

		// This is the core function for finding Items on a track given a point or segment of the Timetable. All the public query methods delegate to this
		// TODO - investigate quicker (eg binary?) search to find first item quickly. May need an extra sort index.
		function _queryItems(start, end, testFunc) {
			if (((typeof start) == "number") !== this.timetable.numerical)
			{
				throw new Error("Cannot get Item(s) - point(s) not in the correct scale type.");
			}

			var items = this.items,
				results = {items: [], indices: []},
				num = 0;

			if(!this.timetable.numerical) {
				start = new Date(start);
				end = new Date(end);
			}

			for(var i = 0, l = items.length; i < l; i++) {
				if(items[i].start > end) {
					break;
				}
				if (testFunc.call(items[i], start, end)) {
					results.items[num] = items[i];
					results.indices[num] = i;
					num++;
				}
			}

			return results;
		}

		// helper for use in _queryItems calls
		function _rangeContainsItem(start, end) {
			return ((this.start >= start) && (this.end <= end));
		}

		// helper for use in _queryItems calls and Item.inRange calls
		function _itemOverlapsRange(start, end) {
			return ((this.start < end) && (this.end > start));
		}

		// helper for use in _queryItems calls
		function _itemAtPoint(point) {
			return ((this.start <= point) && (this.end > point));
		}

		Track.prototype = {
			toString : function() {return this.title;},

			/**
			@name glow.widgets.Timetable.Track#addItem
			@function
			@description Factory method for creating an Item and adding it to the Track

			@param {String} title The title
			@param {Date | Number} start The start point
			@param {Date | Number} end The end point
			@param {Object} [opts] Options object
				@param {String} [opts.id=auto-generated] An id for the Item
				@param {String} [opts.className] A class name for the Item's container element
				@param {String | glow.dom.NodeList | Function} [opts.itemTemplate] Specification for templating HTML of the this Item
					<p>Overrides any template specified at Track or Timetable level.</p>
					<ul>
						<li>If a String is provided, it is passed through glow.lang.interpolate, with the Item as the other parameter, and the output is used.</li>
						<li>If a NodeList is provided it is used directly.</li>
						<li>If a function is provided it should take the Item as its only argument, and return the HTML or a NodeList to use.</li>
					</ul>
				@param {Object} [opts.data] An object of arbitrary data to be attached to the Item

			@returns {glow.widgets.Item}
				The created Item.

			@example
				// on a numeric Timetable (1 - 100)
				var myItem = myTrack.addItem("Some Item", 10, 14);
			*/
			addItem : function(title, start, end, options) {
				var item = _factoryItem.call(this, title, start, end, options);
				_sortItems.call(this);

				return item;
			},

			/**
			@name glow.widgets.Timetable.Track#itemAt
			@function
			@description Returns the Item that is on the Track at the given point

			@param {Date | Number} point The point on the Track to inspect
			@returns {Item}

			@example
				var anItem = myTrack.itemAt("31 December 1999 23:59");
				// anItem now holds a reference to a glow.Timetable.Item
			*/
			itemAt : function(point) {
				return _queryItems.call(this, point, point, _itemAtPoint).items[0];
			},

			/**
			@name glow.widgets.Timetable.Track#indexAt
			@function
			@description Finds the Item that is on the Track at the given point, and returns it's index in the items[] property

			@param {Date | Number} point The point on the Track to inspect
			@returns {Number}

			@example
				var nowIndex = myTrack.indexAt(new Date());
				var now = myTrack.items[nowIndex];
				var next = myTrack.items[nowIndex + 1];
			*/
			indexAt : function(point) {
				return _queryItems.call(this, point, point, _itemAtPoint).indices[0];
			},

			/**
			@name glow.widgets.Timetable.Track#itemsAt
			@function
			@description Returns an array of any Items that are on the Track at the given point
				Items appear in the array in "choronological" order
			@param {Date | Number} point The point on the Track to inspect
			@returns {Item[]}

			@example
				var someItems = myTrack.itemsAt("31 December 1999 23:59");
				// someItems now holds a reference to an Array of glow.Timetable.Items
			*/
			itemsAt : function(point) {
				return _queryItems.call(this, point, point, _itemAtPoint).items;
			},

			/**
			@name glow.widgets.Timetable.Track#indicesAt
			@function
			@description Finds any Items that are on the Track at the given point, and returns an array of their indices in the items[] property
				Items appear in the array in "choronological" order
			@param {Date | Number} point The point on the Track to inspect
			@returns {Number[]}

			@example
				var someIndexes = myTrack.indicesAt("31 December 1999 23:59");
				// someIndexes now holds a reference to an Array of integers
			*/
			indicesAt : function(point) {
				return _queryItems.call(this, point, point, _itemAtPoint).indices;
			},

			/**
			@name glow.widgets.Timetable.Track#itemsInRange
			@function
			@description Returns an array of any Items that are on the Track overlapping the given range
				Items appear in the array in "choronological" order
			@param {Date | Number} start The start point of the portion of the Track to inspect
			@param {Date | Number} end The end point of the portion of the Track to inspect
			@returns {Item[]}

			@example
				var someItems = myTrack.itemsInRange("31 December 1999 23:59", "1 January 2000 00:01");
				// someItems now holds a reference to an Array of glow.Timetable.Items
			*/
			itemsInRange : function(start, end) {
				return _queryItems.call(this, start, end, _itemOverlapsRange).items;
			},

			/**
			@name glow.widgets.Timetable.Track#indicesInRange
			@function
			@description Finds any Items that are on the Track overlapping the given range, and returns an array of their indices in the items[] property
				Items appear in the array in "choronological" order
			@param {Date | Number} start The start point of the portion of the Track to inspect
			@param {Date | Number} end The end point of the portion of the Track to inspect
			@returns {Number[]}

			@example
				var someIndexes = myTrack.indicesInRange("31 December 1999 23:59", "1 January 2000 00:01");
				// someIndexes now holds a reference to an Array of integers
			*/
			indicesInRange : function(start, end) {
				return _queryItems.call(this, start, end, _itemOverlapsRange).indices;
			},

			/**
			@name glow.widgets.Timetable.Track#setItemTemplate
			@function
			@description Sets the Default Item template for this track
				The {@link glow.widgets.Timetable.Item item} will be passed into the template.
			@param {String | glow.dom.NodeList | function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setItemTemplate : function(template) {
				this._opts.itemTemplate = template;

				return this;
			},

			/**
			@name glow.widgets.Timetable.Track#setTrackHeaderTemplate
			@function
			@description Sets the header template for this track
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
			@param {String | glow.dom.NodeList | function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setTrackHeaderTemplate : function(template) {
				this._opts.trackHeader = template;

				return this;
			},

			/**
			@name glow.widgets.Timetable.Track#setTrackFooterTemplate
			@function
			@description Sets the footer template for this track
				The {@link glow.widgets.Timetable.Track track} will be passed into the template.
			@param {String | glow.dom.NodeList | function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setTrackFooterTemplate : function(template) {
				this._opts.trackFooter = template;

				return this;
			},

			/**
			@name glow.widgets.Timetable.Item#getHeader
			@function
			@description Gets the actual content of if the Track header (if any) for the Timetable to display
			@returns glow.dom.NodeList
			*/
			getHeader : function() {
				return _buildFromTemplate.call(this, this._opts.trackHeader || this.timetable._opts.trackHeader);
			},

			/**
			@name glow.widgets.Timetable.Item#getFooter
			@function
			@description Gets the actual content of if the Track footer (if any) for the Timetable to display
			@returns glow.dom.NodeList
			*/
			getFooter : function() {
				return _buildFromTemplate.call(this, this._opts.trackFooter || this.timetable._opts.trackFooter);
			}
		};

		/**
		@name glow.widgets.Timetable.Item
		@class
		@description An Item is an "event" on a Track.

		@glowPrivateConstructor An Item cannot be directly instantiated. Instead the {@link glow.widgets.Timetable.Track#addItem addItem} method of glow.widgets.Timetable.Track must be used.
		*/
		function Item(track, title, start, end, opts) {
			/**
			@name glow.widgets.Timetable.Item#_addIndex
			@private
			@type Number
			@description An integer that increments by one for each Item added to the track, so that each Item has a different and constant _addIndex. This is then used in Item sorting to force stability on the sort algorithm in JS engines (like V8) that use an unstable sort.
			*/
			this._addIndex = track.items.length;

			this._opts = opts = $apply({
				className: ""
			}, opts || {});

			if (((typeof start) == "number") !== track.timetable.numerical)
			{
				throw new Error("Item scale type does not match Timetable.");
			}

			/**
			@name glow.widgets.Timetable.Item#data
			@type Object
			@description The Item's arbitrary data store
				This can be used to attach any arbitrary data to the Item, without the possibility of conflicting with the Item's designed properties.
			@example
				myItem.data.moreInfoUrl = "someUrl"; // used in the Item templare to provide a link to a "more info" page.
			*/
			this.data = opts.data || {};

			/**
			@name glow.widgets.Timetable.Item#title
			@type String
			@description The Item's title
			*/
			this.title = title;

			/**
			@name glow.widgets.Timetable.Item#start
			@type Date | Number
			@description The Item's start point
			*/
			this.start = start;

			/**
			@name glow.widgets.Timetable.Item#end
			@type Date | Number
			@description The Item's end point
			*/
			this.end = end;

			if(!track.timetable.numerical) {
				this.start = new Date(start);
				this.end = new Date(end);
			}

			/**
			@name glow.widgets.Timetable.Item#track
			@type glow.widgets.Timetable.Track
			@description The Item's parent Track
			*/
			this.track = track;

			/**
			@name glow.widgets.Timetable.Item#id
			@type String
			@description The Item's id
			*/
			this.id = opts.id || getId();

			/**
			@name glow.widgets.Timetable.Item#element
			@type glow.dom.Nodelist
			@description The HTML element that represents the item in the Timetable.
			*/
			this.element;
		}

		Item.prototype = {
			toString : function() {return this.title;},

			/**
			@name glow.widgets.Timetable.Item#setItemTemplate
			@function
			@description Sets the Default Item template for the Timetable
				The {@link glow.widgets.Timetable.Item item} will be passed into the template.
			@param {String | glow.dom.NodeList | function} template The template to use
			@returns this

			@see <a href="../furtherinfo/widgets/timetable/templating.shtml">Templating within a Timetable</a>
			*/
			setItemTemplate : function(template) {
				this._opts.itemTemplate = template;

				return this;
			},

			/**
			@name glow.widgets.Timetable.Item#getContent
			@function
			@description Gets the actual content of the Item for the Timetable to display
			@returns glow.dom.NodeList
			*/
			getContent : function() {
				return _buildFromTemplate.call(this, this._opts.itemTemplate || this.track._opts.itemTemplate || this.track.timetable._opts.itemTemplate);
			},



			/**
			@name glow.widgets.Timetable.Item#inRange
			@function
			@description Returns true if the Item overlaps the range with the given start and end points
			@returns Boolean

			@example
				var item = myTrack.addItem("Item", 1, 2);

				if (item.inRange(0, 1.5)) {
					// code here runs
				}

				if (item.inRange(3, 4)) {
					// code here doesn't run
				}
			*/
			inRange : function (start, end) {

				if(!this.track.timetable.numerical) {
					start = new Date(start);
					end = new Date(end);
				}

				return _itemOverlapsRange.call(this, start, end);

			}
		};

		glow.widgets.Timetable = Timetable;
		glow.widgets.Timetable.Track = Track;
		glow.widgets.Timetable.Item = Item;

		/**
		@name glow.widgets.Timetable.View
		@private
		@class
		@description Deals with the rendering of the timetable

		@param {glow.widgets.Timetable} timetable The timetable instance to render
		*/
		var View;

		(function() {
			// TODO test keyboard navigation of items (can they be focused and clicked?)
			var containerTemplate = '' +
					'<div>' +
						'<div class="timetable-theme">' +
							'<div class="timetable-state">' +
								'<div class="timetable-container">' +
									'<div class="timetable-accessibility-navigation">{ACCESSIBILITY_INTRO}</div>' +
									'<div class="timetable-track-headers" role="presentation" id="' + glow.UID + 'TimetableWidgetHeaders"></div>' +
									'<div class="timetable-scrollView">' +
										'<div class="timetable-scrollbar1"></div>' +
										'<div class="timetable-innerView">' +
											'<div class="timetable-dragRange">' +
												'<div class="timetable-dragArea" aria-live="polite">' +
												'</div>' +
											'</div>' +
										'</div>' +
										'<div class="timetable-scrollbar2"></div>' +
									'</div>' +
									'<div class="timetable-track-footers" role="presentation" id="' + glow.UID + 'TimetableWidgetFooters"></div>' +
								'</div>' +
							'</div>' +
						'</div>' +
					'</div>',
				headerHolderTemplate = '' +
					'<div class="timetable-header-holder"></div>',
				footerHolderTemplate = '' +
					'<div class="timetable-footer-holder"></div>',
				trackTemplate = '' +
					'<div class="timetable-track"><ol class="timetable-trackList"></ol></div>',
				itemHolderTemplate = '' +
					'<li class="timetable-item" tabindex="0"></li>',
				scaleTemplate = '' +
					'<div class="timetable-scale"></div>',
				scaleItemTemplate = '' +
					'<div class="timetable-scaleItem"></div>',
				emptyDiv = $dom.create('<div></div>'),
				// the maximum number of pixels (in any direction) the mouse can move between mousedown and click to count as 'clicking' rather than dragging
				mouseMoveTolerance = 10;

			// called when the mouse moves during a timetable drag
			function _mouseMoveDuringTimetableDrag(event) {
				if (!this._clickStart) {
					// this is the first run of this, capture the mouse position
					this._clickStart = [event.pageX, event.pageY];
				}
				// cancel the click if the mouse has moved outside the tolerance range
				else if (
					!this._cancelNextItemClick && // no point recalculating if we've already canceled
					(Math.abs(this._clickStart[0] - event.pageX) > mouseMoveTolerance ||
					 Math.abs(this._clickStart[1] - event.pageY) > mouseMoveTolerance)
				) {
					this._cancelNextItemClick = true;
				}

				// call _moveToPosition with the correct value
				_moveToPosition.call( this, this.currentPosition() );
			}

			// here we work out if we should react to the click or not
			function _dragAreaClicked(event) {
				if (this._cancelNextItemClick) return false;
				// TODO work out which item, if any, has been clicked and fire itemClicked event

				var itemElm = $(event.source);

				// bubble up until we find the item the user clicked on
				while (itemElm[0] != event.attachedTo) {
					if ( itemElm.hasClass("timetable-item") ) {
						// found it!
						$fire(this._timetable, "itemClick", $apply({item: this.itemInstance[ itemElm[0].id ]}, new $events.Event(event)));
					}
					itemElm = itemElm.parent();
				}
			}

			// called before the timetable begins to move
			function _moveStart() {
				// TODO does anything need to be included in this event?
				// TODO make cancelable
				$fire(this._timetable, "moveStart");
			}

			// updates the position of elements for a given val
			function _moveToPosition(val) {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable);

				// update any interface element that need changing
				this._dragAreaElm.css( vocab.pos, -(_valToPos.call(this, val)) );
				// TODO add slider position updates here
				if (this._scrollbar1) {
					this._scrollbar1.moveToPosition(val);
				}
				if (this._scrollbar2) {
					this._scrollbar2.moveToPosition(val);
				}

			}

			// called when a moving action ends that triggered a _moveStart (ie, not pragmatic change)
			function _moveStop() {
				$fire(this._timetable, "moveStop");
			}

			// called when the timetable has completed a move (eg, dragging is complete or position is changed programmatically)
			function _moved() {
				// move elements that are half in view
				_adjustContentPosition.call(this);
				// fire the change event if we should
				_fireChangeEvent.call(this);
			}

			// move content of items into view, and reset others
			function _adjustContentPosition() {

				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					i = 0,
					len = timetable.tracks.length,
					item,
					itemToAdjust,
					itemContentToAdjust,
					itemId,
					currentPos = timetable.currentPosition(),
					itemPixelOffset,
					newMargin,
					posPixelOffset = parseInt( this._dragAreaElm[0].style[vocab.pos] );

				// reset position of other items
				if (this._timetable._opts.keepItemContentInView) {
					this._itemContentHangingOffStart.css("margin-" + vocab.pos, 0);
					this._itemsHangingOffStart.removeClass("timetable-itemHangingClipping");
				}
				this._itemsHangingOffStart.removeClass("timetable-itemHangingOffStart");

				// start collecting new items to move
				this._itemContentHangingOffStart = new $dom.NodeList();
				this._itemsHangingOffStart = new $dom.NodeList();

				for (; i < len; i++) {
					// get hold of the item element and its inner content
					item = timetable.tracks[i].itemAt(currentPos);
					// no item found? Also, skip items that start at the current time
					if ( !item || item.start.valueOf() == currentPos.valueOf() ) {
						continue;
					}
					itemId = item.id;
					itemContentToAdjust = this.itemContent[ itemId ];
					itemToAdjust = this.items[ itemId ];

					this._itemContentHangingOffStart.push(itemContentToAdjust);
					this._itemsHangingOffStart.push(itemToAdjust);

					if (this._timetable._opts.keepItemContentInView) {
						// find out what the pixel offset of the item is
						itemPixelOffset = parseInt( itemToAdjust[0].style[vocab.pos] );
						newMargin = -posPixelOffset - itemPixelOffset;
						itemContentToAdjust.css("margin-" + vocab.pos,
							newMargin
						);
						// is the content clipping against the bottom of the item box?
						if (itemToAdjust[vocab.length]() < (itemContentToAdjust[vocab.length]() + newMargin)) {
							itemToAdjust.addClass("timetable-itemHangingClipping");
						}
					}
				}
				this._itemsHangingOffStart.addClass("timetable-itemHangingOffStart");
			}

			// get pixel value for a timetable unit
			function _valToPos(val) {
				return (val - this._timetable.start) / this.scale;
			}

			// get a value for a pixel position
			function _posToVal(pos) {
				return (pos * this.scale) + this._timetable.start.valueOf();
			}

			// only fire change event if the value has changed
			function _fireChangeEvent() {
				var timetable = this._timetable,
					newPos = timetable.currentPosition();

				if(newPos.valueOf() != this._posBeforeMove.valueOf()) {
					$fire(timetable, "change");
					this._posBeforeMove = newPos;
					_updateHiddenNavSelect.call(this);

				}
			}

			// create an item element from Item instance
			function _createItem(item, border) {
				// generate container
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					itemPos = _valToPos.call(this, item.start),
					itemLength = _valToPos.call(this, item.end) - itemPos,
					itemElm = $dom.create(itemHolderTemplate),
					itemContent = item.getContent() || _itemDefaultContent(item);

				// add class name & id
				itemElm.attr("id", item.id);
		 		itemContent[0].className = "timetable-itemContent " + item._opts.className;

		 		var self = this;

				item.element = this.items[item.id] = itemElm;
				this.itemContent[item.id] = itemContent;
				this.itemInstance[item.id] = item;

				// we need to deduct borders from the item length. We deduct 2 borders if we're not collapsing. One otherwise.
				itemLength -= border * ((!timetable._opts.collapseItemBorders) + 1);
				// size and position

				// it's possible the itemLength has gone below 0, which it shouldn't
				if (itemLength < 0) {
					itemLength = 0;
				}

				itemElm.css(vocab.pos, itemPos)
					.css(vocab.length, itemLength);

				// add content
		 		itemElm.append(itemContent);
				// return container
				return itemElm;
			}

			function _itemDefaultContent(item) {
				return $create("<div>" + item.title + "</div>");
			}

			function _drawTrack(track) {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					items = track.items,
					i = 0,
					len = items.length,
					trackElm = this.tracks[track.id],
					header = this._headers[track.id],

					footer = this._footers[track.id],

					trackListElm,
					itemBorder,
					itemElmTmp,
					item;

				// generate html for the track if we haven't already
				if (!trackElm) {
					trackElm = this.tracks[track.id] = _createTrack.call(this, track);
					// size the track
					trackElm.css(vocab.breadth, track.size);
					trackElm.appendTo( this._dragAreaElm );
					// draw headers and footers for this track (if needed)
					_drawHeaderAndFooter.call(this, track);
					if(header) {
						trackElm.prepend(header.clone().removeClass("timetable-header-holder").addClass("timetable-accessibility-hidden"));
					}
					if(footer) {
						trackElm.append(footer.clone().removeClass("timetable-footer-holder").addClass("timetable-accessibility-hidden"));
					}
				}



				trackListElm = trackElm.get("> ol");

				// calculate an item border for this track
				itemElmTmp = $dom.create(itemHolderTemplate).appendTo(trackListElm);
				itemBorder = parseInt(itemElmTmp.css(["border-" + vocab.pos + "-width", "border-" + vocab.posOpposite + "-width"])) / 2;
				itemElmTmp.remove();

				// loop over items
				for (; i < len; i++) {
					item = track.items[i];
					// if item isn't already drawn
					if (!this.items[item.id]) {
						// append item to track and save in register
						_createItem.call(this, items[i], itemBorder).appendTo(trackListElm);
					}
				}
			}

			function _drawHeaderAndFooter(track) {
				var content,
					id = track.id;

				content = track.getHeader();

				// do we have content?
				if (content) {
					// get and add the content
					this._headers[id] = $dom.create(headerHolderTemplate).append( content.addClass("timetable-header-content") );
					this._headerElm.append(this._headers[id])
						.append('<a class="timetable-accessibility-hidden" href="#' + id + '">' + this._locale.SKIPLINK_TO_TRACK + '</a>');
				}

				content = track.getFooter();

				if (content) {
					this._footers[id] = $dom.create(footerHolderTemplate).append( content.addClass("timetable-footer-content") );
					this._footerElm.append(this._footers[id])
					   .append('<a class="timetable-accessibility-hidden" href="#' + glow.UID + 'TimetableWidgetHeaders">' + this._locale.SKIPLINK_BACK_TO_HEADERS + '</a>');
				}
			}

			function _createTrack(track) {
				var r = $dom.create(trackTemplate).attr("id", track.id);

				// TODO add class name & id
				return r;
			}

			function _positionTracks() {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					i = 0,
					tracksLen = timetable.tracks.length,
					primaryScalesLen = this._primaryScaleElms.length,
					secondaryScalesLen = this._secondaryScaleElms.length,
					lenTotal = tracksLen + primaryScalesLen + secondaryScalesLen,
					trackElm,
					headerElm,
					footerElm,
					headerMaxLength = 0,
					footerMaxLength = 0,

					headerFooterOffset,
					headerFooterBreadth,
					breadthBorders = ["border-" + vocab.otherPos + "-width", "border-" + vocab.otherPosOpposite + "-width"],
					posSum = 0,
					collapseBorders = timetable._opts.collapseTrackBorders,
					border,
					margin,
					size,
					id,
					trackObj;


				headerFooterOffset = this._scrollbar1Elm[vocab.breadth]() - parseInt( this._headerElm.css("border-" + vocab.otherPos + "-width") );


				for (; i < lenTotal; i++) {
					// figure out what we're looping through
					if (i < primaryScalesLen) {
						trackElm = this._primaryScaleElms[i];
						headerElm = footerElm = null;
					} else if (i < primaryScalesLen + tracksLen) {
						trackObj = timetable.tracks[i-primaryScalesLen];
						id = trackObj.id;
						trackElm = this.tracks[id];
						headerElm = this._headers[id];
						footerElm = this._footers[id];
						if (trackObj.disabled) {
							// ensure the elements are hidden
							$(trackElm, headerElm, footerElm).css("display", "none");
							continue;
						} else {
							// ensure the elements are shown
							$(trackElm, headerElm, footerElm).css("display", "");
						}
					} else {
						trackElm = this._secondaryScaleElms[i-primaryScalesLen-tracksLen];
						headerElm = footerElm = null;
					}

					border = parseInt(trackElm.css(breadthBorders)) / 2;
					// || 0 is to catch IE return 'auto' for margin
					margin = collapseBorders ? 0 : parseInt(trackElm.css("margin-" + vocab.otherPosOpposite)) || 0;
					size = parseInt(trackElm.css(vocab.breadth)) + (border * ((!collapseBorders) + 1)) + margin;
					// set breadth and position
					trackElm.css(vocab.otherPos, posSum);
					if(headerElm) {
						headerElm.css(vocab.otherPos, posSum + headerFooterOffset).css(vocab.breadth, trackObj.size + 2 * border);
						headerMaxLength = Math.max(
							parseInt( headerElm.css(vocab.length) ),
							headerMaxLength
						);

					}

					if(footerElm) {
						footerElm.css(vocab.otherPos, posSum + headerFooterOffset).css(vocab.breadth, trackObj.size + 2 * border);
						footerMaxLength = Math.max(
							parseInt( footerElm.css(vocab.length) ),
							footerMaxLength
						);

					}

					// deduct border if we're collapsing borders. We deduct 2 borders if we're not collapsing. One otherwise.
					posSum += size;
				}


				// set this.element to be width / height of the total, ignoring the final margin
				this._innerViewElm.css(vocab.breadth, posSum + (border * collapseBorders) - margin);
				// set the width / height of header and footer containers
				headerFooterBreadth = posSum + (border * collapseBorders) - margin + headerFooterOffset + this._scrollbar2Elm[vocab.breadth]();

				$(this._headerElm, this._footerElm).css(vocab.breadth,
					headerFooterBreadth
					- parseInt( this._headerElm.css("border-" + vocab.otherPosOpposite + "-width") )
				);

				// set container sizes
				this._headerElm.css(vocab.length, headerMaxLength);
				this._footerElm.css(vocab.length, footerMaxLength);
			}

			function _drawBanding() {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					i = 0,
					len = timetable._banding.length - 1,
					bandStart,
					bandStartPos,
					bandEnd,
					bandEndPos,
					band;

				// loop through the banding points
				for (; i < len; i++) {
					bandStart = timetable._banding[i].valueOf();
					bandEnd = timetable._banding[i+1].valueOf();

					// get pixel values for band positions
					bandStartPos = _valToPos.call(this, bandStart);
					bandEndPos = _valToPos.call(this, bandEnd) - bandStartPos;

					// create our band
					band = emptyDiv.clone()
						// set its starting position
						.css(vocab.pos, bandStartPos)
						// set its length
						.css(vocab.length, bandEndPos)
						// add class name
						.addClass( "timetable-band" + (i%2 ? 'Odd' : 'Even') )
						// add to document
						.appendTo( this._dragAreaElm );

				}
			}

			function _createScale(scaleData) {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					scaleElm = $create(scaleTemplate).css(vocab.breadth, scaleData.size),
					i = 0,
					points = scaleData.points,
					len = points.length - 1,
					itemStart,
					itemStartPos,
					itemEnd,
					itemLength,
					itemContext;

				scaleElm[0].id = scaleData.opts.id || "";
				scaleElm[0].className += " " + (scaleData.opts.className || "");

				// loop though points
				for (; i < len; i++) {
					itemStart = points[i].valueOf();
					itemEnd = points[i+1].valueOf();

					// get pixel positions
					itemStartPos = _valToPos.call(this, itemStart);
					itemLength = _valToPos.call(this, itemEnd) - itemStartPos;

					// create template data object
					itemContext = {
						start: points[i],
						end: points[i+1]
					}

					// create our item
					$create(scaleItemTemplate)
						.append( _buildFromTemplate.call(itemContext, scaleData.template).addClass('timetable-itemContent') )
						.css(vocab.pos, itemStartPos)
						.css(vocab.length, itemLength)
						.appendTo(scaleElm);
				}

				return scaleElm;
			}

			function _drawScales() {
				var timetable = this._timetable,
					i = timetable._primaryScales.length,
					largestIndex;

				this._primaryScaleElms = [];
				this._secondaryScaleElms = [];

				// beginning scales
				while (i--) {
					this._primaryScaleElms[i] = _createScale.call(this, timetable._primaryScales[i]).addClass("timetable-scalePrimary").appendTo(this._dragAreaElm);
				}
				// end scales
				i = timetable._secondaryScales.length;
				largestIndex = i - 1;
				while (i--) {
					// add them to the elms array in reverse
					this._secondaryScaleElms[largestIndex - i] = _createScale.call(this, timetable._secondaryScales[i]).addClass("timetable-scaleSecondary").appendTo(this._dragAreaElm);
				}
			}

			// add a css rule to the page
			function _setStyle(selector, style) {
				$create('<style type="text/css">' + selector + " { " + style + ' } </style>').appendTo("head");
			}

			function _drawScrollbars() {
				// TODO: make these optional and based on API
				var timetable = this._timetable,
					primary = timetable._primaryScrollbar,
					secondary = timetable._secondaryScrollbar;
				
				// we need to show / hide the scrollbar elm because IE threw its toys out of the pram
				if (primary) {
					this._scrollbar1Elm.css("display", "block");
					this._scrollbar1 = new TimetableScrollbar(this, this._scrollbar1Elm, primary);
				}
				this._scrollbar1Elm.css("display", primary ? "block" : "");
				if (secondary) {
					this._scrollbar2Elm.css("display", "block");
					this._scrollbar2 = new TimetableScrollbar(this, this._scrollbar2Elm, secondary);
				}
				this._scrollbar2Elm.css("display", secondary ? "block" : "");
			}

			function _setDraggableSizes() {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					dragAreaSize,
					dragRangeSize;

				// size draggable & drag range
				dragAreaSize = _valToPos.call(this, timetable.end);
				dragRangeSize = (dragAreaSize * 2) - this._viewSize;
				// vocab.length is width / height
				this._dragAreaElm[vocab.length](dragAreaSize);
				this._dragRangeElm[vocab.length](dragRangeSize).css("margin-" + vocab.pos, - dragAreaSize + this._viewSize);
			}

			function _calculateScale() {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable);

				// vocab.length is width / height
				this._viewSize = this._innerViewElm[vocab.length]();
				/**
				@name glow.widgets.Timetable.View#scale
				@private
				@type Number
				@description The units per pixel scale of the Timetable
				*/
				this.scale = (timetable._viewEnd - timetable._viewStart) / this._viewSize;
			}

			function _initDraggable() {
				var timetable = this._timetable,
					vocab = getVocab.call(timetable),
					that = this;

				this._draggable = new glow.dragdrop.Draggable(this._dragAreaElm, {
					axis: vocab.dragAxis,
					container: this._dragRangeElm,
					placeholder: "none",
					onDrag: function() {
						// we need to distinguish between a drag and a click
						that._cancelNextItemClick = false;
						that._clickStart = 0;
						// listen for mouse moving
						that._mouseMoveListener = $listen(document, "mousemove", _mouseMoveDuringTimetableDrag, that);
						// TODO, make this cancelable
						_moveStart.call(that);
						_clearItemHiding.call(that);

					},
					onDrop: function() {
						_moveStop.call(that);
						_moved.call(that);
						// remove mouse move listener
						that._mouseMoveListener && glow.events.removeListener(that._mouseMoveListener);
					}
				});
			}

			function _hideOutOfView () {

				var timetable = this._timetable,
					tracks = timetable.tracks,
					numTracks = tracks.length,
					inCurrentView = this._inCurrentView,
					innerViewElm = this._innerViewElm,
					newView = null,
					viewRange = timetable.viewRange(),
					viewStart = viewRange.start,
					viewEnd = viewRange.end,
					id = "",
					i = 0,
					l = 0;

				if(inCurrentView == null) {
					innerViewElm.addClass("timetable-hideitems");
					this._inCurrentView = inCurrentView = {};
				}

				for(id in inCurrentView) {
					if(!inCurrentView[id].inRange(viewStart, viewEnd)) {
						delete inCurrentView[id];
						$(id).css("display", "");
					}
				}

				for(j = 0; j < numTracks; j++) {
					
					newView = tracks[j].itemsInRange(viewStart, viewEnd)
					
					for(i = 0, l = newView.length; i < l; i++) {
						id = newView[i].id;
						
						if(!inCurrentView[id]) {
							inCurrentView[id] = newView[i];
							$("#" + id).css("display", "block");
						}
					}
				}
			}

			function _clearItemHiding() {
				for(id in this._inCurrentView) {
					$("#" + id).css("display", "");
				}
				this._inCurrentView = null;
				this._innerViewElm.removeClass("timetable-hideitems");
			}



			function _createHiddenNavSelect() {
				var timetable = this._timetable,
					spec = timetable._primaryScales[0] || timetable._secondaryScales[0] || timetable._primaryScrollbar || timetable._secondaryScrollbar;
					
				if(spec) {
					var points = spec.points,
						entries = [],
						len = points.length - 1,
						itemContext,
						i = 0,
						that = this,
						lastViewStart = timetable.end - timetable._viewWindowSize,
						startOption = '<option value="' + timetable.start.valueOf() + '">' + this._locale.ACCESSIBILITY_MENU_START + '</option>',
						endOption = '<option value="' + lastViewStart.valueOf() + '">' + this._locale.ACCESSIBILITY_MENU_END + '</option>';
						
					for(; i < len; i++) {
						itemContext = {
							start: points[i],
							end: points[i + 1]
						}
						if ((itemContext.start >= timetable.start) && (itemContext.start <= lastViewStart)) {
							entries[i] = '<option value="' + points[i].valueOf() + '">' + _buildFromTemplate.call(itemContext, spec.template).text() + '</option>';
							if (itemContext.start.valueOf() == timetable.start.valueOf()) {
								startOption = '';
							}
							if (itemContext.start.valueOf() == lastViewStart.valueOf()) {
								endOption = '';
							}
						}
					}
					var select = this._accessibiltySelect = $dom.create('<select>' + startOption + entries.join('') + endOption + '</select>');
					
					$listen(select, "change", function() {
						that._timetable.currentPosition(select.val() * 1);
						_hideOutOfView.call(that);
					});
					this._accessibiltyElm.append(select);
					_updateHiddenNavSelect.call(this);
				}
			}



			function _updateHiddenNavSelect() {
				
				if(this._accessibiltySelect) {
					var currentPos = this.currentPosition(),
						selectOptions = this._accessibiltySelect[0].options,
						i = 0,
						len = selectOptions.length,
						val = selectOptions[i].value * 1,
						tmp;
						
					for (; i < len; i++) {
						tmp = selectOptions[i].value * 1;
						if(tmp <= (currentPos + this.scale)) val = tmp; // add scale to allow for rounding errors
					}
					this._accessibiltySelect.val(val);
				}
			}



			View = function (timetable) {
				var vocab = getVocab.call(timetable),
					that = this;

				// storage for determining event firing
				this._cancelNextItemClick = false;
				this._posBeforeMove = timetable.currentPosition();

				this._timetable = timetable;

				this._headers = {};
				this._footers = {};

				this._inCurrentView = null;

				this._locale = $i18n.getLocaleModule("GLOW_WIDGETS_TIMETABLE");

				/**
				@name glow.widgets.Timetable.View#tracks
				@private
				@type Object
				@description A NodeList of a rendered track, indexed by ID
				*/
				this.tracks = {};
				/**
				@name glow.widgets.Timetable.View#items
				@private
				@type Object
				@description A NodeList of a rendered item, indexed by ID
				*/
				this.items = {};
				/**
				@name glow.widgets.Timetable.View#itemContent
				@private
				@type Object
				@description A NodeList of a rendered item's content, indexed by ID
				*/
				this.itemContent = {};
				/**
				@name glow.widgets.Timetable.View#itemInstance
				@private
				@type Object
				@description Instance of an item, indexed by ID
				*/
				// TODO: should this be outside the view, perhaps a getItemById function on timetable?
				this.itemInstance = {};

				/**
				@name glow.widgets.Timetable.View#element
				@private
				@type glow.dom.NodeList
				@description Outer element
				*/
				// init html interface and apply and class names we need
				this.element = $dom.create(containerTemplate, {interpolate: this._locale}).attr("id", timetable.id);
				this.element[0].className = timetable._opts.className;

				this.element.addClass(vocab.rootClass);


				// get hold of the elements we need
				this._headerElm = this.element.get("div.timetable-track-headers");

				this._footerElm = this.element.get("div.timetable-track-footers");

				this._accessibiltyElm = this.element.get("div.timetable-accessibility-navigation");

				this._stateElm = this.element.get("div.timetable-state");
				this._themeElm = this.element.get("div.timetable-theme");
				this._innerViewElm = this.element.get("div.timetable-innerView");
				this._dragRangeElm = this.element.get("div.timetable-dragRange");
				this._dragAreaElm = this.element.get("div.timetable-dragArea");
				this._scrollbar1Elm = this.element.get("div.timetable-scrollbar1");
				this._scrollbar2Elm = this.element.get("div.timetable-scrollbar2");

				// apply theme class
				this._themeElm.addClass(
					"timetable-" + timetable._opts.theme
				);

				// set a private var for elements that are half in view at the start of the view
				// set and used by _adjustContentPosition
				this._itemsHangingOffStart = new $dom.NodeList();
				this._itemContentHangingOffStart = new $dom.NodeList();

				// listen for clicks within the drag area
				$listen(this._dragAreaElm, "click", _dragAreaClicked, this);

			};

			View.prototype = {
				/**
				@name glow.widgets.Timetable.View#draw
				@private
				@function
				@description Draw the timetable's tracks and items

				@param {Boolean} [redraw=false] Redraw items that have already been drawn

				@returns this
				*/
				draw: function(redraw) {
 					var timetable = this._timetable,
						vocab = getVocab.call(timetable),
						calculatedViewSize = timetable.size,
						tracks = timetable.tracks,
						len = tracks.length,
						startPosition,
						i = 0;

					if (!this._drawn) { // first draw
						// empty the container, add element to page
						this.element.appendTo( timetable._container.empty() );
						// init draggable
						_initDraggable.call(this);
					}

					if (redraw) {
						// capture the current position
						startPosition = timetable.currentPosition();
						// if redraw is true, trash our 'drawn' registry and empty our view
						this.tracks = {};
						this.items = {};
						this.itemContent = {};
						this.itemInstance = {};
						// clear all items
						this._dragAreaElm.empty();
						// destroy scrollbars
						this._scrollbar1Elm.empty();
						this._scrollbar2Elm.empty();
						// get rid of headers and footers
						this._headerElm.empty();
						this._footerElm.empty();
						// empty hidden a11y nav
						this._accessibiltyElm.empty();
						this._headers = {};
						this._footers = {};
					}

					if (redraw || !this._drawn) {
						this._innerViewElm[vocab.length]( calculatedViewSize );
						_calculateScale.call(this);
						_drawBanding.call(this);
						_drawScrollbars.call(this);
						_setDraggableSizes.call(this);
						_drawScales.call(this);
						_createHiddenNavSelect.call(this);
						// set start position
						_moveToPosition.call(this, startPosition || timetable._viewStart);

					}

					// loop over tracks
					for (i = 0; i < len; i++) {
						_drawTrack.call(this, tracks[i]);
					}

					// set up the width of the tracks (and scales)
					_positionTracks.call(this);
					_adjustContentPosition.call(this);

					this._drawn = true;

					return this;
				},
				/**
				@name glow.widgets.Timetable.View#currentPosition
				@private
				@function
				@description Get or sets the

				@param {Number | Date} [val] Value to move to. Omit to get the current value

				@returns Number for getting, 'this' when setting.
				*/
				currentPosition: function(val) {
					var vocab = getVocab.call(this._timetable);

					if (val === undefined) { // getting
						return _posToVal.call( this, -parseInt(this._dragAreaElm[0].style[vocab.pos]) );
					} else { // setting
						_clearItemHiding.call(this);

						_moveToPosition.call(this, val);
						_moved.call(this);
						return this;
					}
				},



				hide : function () {

					_hideOutOfView.call(this);

				},

				clear : function () {

					_clearItemHiding.call(this);

				}
			};

			var TimetableScrollbar;

			(function() {
				var scrollbarNum = 0;

				function _scrollbarChange() {
					if (this._ignoreChange) {
						return;
					}
					// update UI
					_moveToPosition.call( this._timetable._view, (this._timetable._opts.vertical ? -1 : 1) * this.slider.val() );

					if (!this._isDraggingChange) {
						_moved.call(this._timetable._view);
					}
				}

				// called when a dragging action start
				function _scrollbarMoveStart() {
					_clearItemHiding.call(this._timetable._view)
					// we use this to tell if a change is a dragging change or set programmatically
					this._isDraggingChange = true;
					_moveStart.call(this._timetable._view);
				}

				// called when a dragging action stops
				function _scrollbarMoveStop() {
					this._isDraggingChange = false;
					_moveStop.call(this._timetable._view);
					_moved.call(this._timetable._view);
				}

				function _positionHighlight() {
					var timetable = this._timetable,
						vocab = getVocab.call(timetable),
						pos = parseInt( this._sliderHandle[0].style[vocab.pos] );

					if (this._timetable._opts.vertical) {
						this._labelsHighlight[0].style.clip = 'rect(' + pos + 'px, auto, ' + (pos + this._handleLength) + 'px, auto)';
					} else {
						this._labelsHighlight[0].style.clip = 'rect(auto, ' + (pos + this._handleLength) + 'px, auto, ' + pos + 'px)';
					}
				}

				// TODO, document this properly
				TimetableScrollbar = function(view, container, scaleData) {
					var timetable = view._timetable,
						vocab = getVocab.call(timetable),
						i = 0,
						points = scaleData.points,
						len = points.length - 1,
						itemStart,
						itemStartPos,
						itemEnd,
						itemLength,
						itemContext,
						labels = $create('<div class="timetable-scrollbarLabels"></div>'),
						id = glow.UID + "scrollbar" + (scrollbarNum++),
						sliderTrack,
						viewSize = timetable._viewEnd - timetable._viewStart,
						timetableSize = timetable.end - timetable.start,
						min,
						max,
						val,
						viewStart = timetable.viewRange().start;

					this._timetable = timetable;

					// set the size of the handle
					_setStyle(
						"#" + id + " .slider-handle",
						vocab.length + ":" + (viewSize/timetableSize)*100 + "%"
					);

					if (timetable._opts.vertical) {
						min = -timetable.end + viewSize;
						max = -timetable.start;
						val = -viewStart;
					} else {
						min = timetable.start-0;
						max = timetable.end - viewSize;
						val = viewStart;
					}

					// we use negative values for min & max for vertical sliders so the 'min' value is at the top (we flip it round later)
					this.slider = new glow.widgets.Slider(container, {
						// we use negative min & maxv values if we're vertical, so the larger abs value is at the bottom
						min: min,
						max: max,
						vertical: timetable._opts.vertical,
						className: "timetable-scrollbar",
						id: id,
						val: val,
						size: view._innerViewElm[vocab.length](),
						step: 0,
						changeOnDrag: true
					});

					sliderTrack = this.slider.element.get("div.slider-track");
					// having to set this for IE6, thanks IE.
					if (timetable._opts.vertical) {
						sliderTrack.css(vocab.length, sliderTrack.get("div.slider-trackOn").css(vocab.length));
					}

					this.slider.element.get("div.slider-btn-bk, div.slider-btn-fwd").push(sliderTrack).css(vocab.breadth, scaleData.size);
					// work out the scale to use
					this.scale = (timetableSize) / sliderTrack[vocab.length]();


					// loop though points top create labels
					for (; i < len; i++) {
						itemStart = points[i].valueOf();
						itemEnd = points[i+1].valueOf();


						// get pixel positions
						itemStartPos = _valToPos.call(this, itemStart);
						itemLength = _valToPos.call(this, itemEnd) - itemStartPos;


						// create template data object
						itemContext = {
							start: points[i],
							end: points[i+1]
						}


						// create our item
						$dom.create('<div class="timetable-scrollbarItem"></div>')
							.append( _buildFromTemplate.call(itemContext, scaleData.template).addClass('timetable-itemContent') )
							.css(vocab.pos, itemStartPos)
							.css(vocab.length, itemLength)
							.appendTo(labels);
					}

					// create highlighted labels
					this._labelsHighlight = labels.clone().addClass("timetable-scrollbarLabelsHighlight");

					// listen for events
					$listen(this.slider, "change", _scrollbarChange, this);
					$listen(this.slider, "slideStart", _scrollbarMoveStart, this);
					$listen(this.slider, "slideStop", _scrollbarMoveStop, this);

					sliderTrack.prepend(labels).prepend(this._labelsHighlight);
					this._sliderHandle = this.slider.element.get("div.slider-handle");
					this._handleLength = this._sliderHandle[vocab.length]();

					_positionHighlight.call(this);
				};

				TimetableScrollbar.prototype = {
					// update the interface of the scrollbar for a particular value
					moveToPosition: function(val) {
						this._ignoreChange = true;
						this.slider.val( (this._timetable._opts.vertical ? -1 : 1) * val );
						this._ignoreChange = false;
						_positionHighlight.call(this);
					}
				};
			})();
		})();
	}
});
/*@end @*/
