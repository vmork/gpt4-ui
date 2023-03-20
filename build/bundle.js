
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.55.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getAugmentedNamespace(n) {
    	if (n.__esModule) return n;
    	var a = Object.defineProperty({}, '__esModule', {value: true});
    	Object.keys(n).forEach(function (k) {
    		var d = Object.getOwnPropertyDescriptor(n, k);
    		Object.defineProperty(a, k, d.get ? d : {
    			enumerable: true,
    			get: function () {
    				return n[k];
    			}
    		});
    	});
    	return a;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    // Generated using scripts/write-decode-map.ts

    var _default$2 = new Uint16Array(
    // prettier-ignore
    "\u1d41<\xd5\u0131\u028a\u049d\u057b\u05d0\u0675\u06de\u07a2\u07d6\u080f\u0a4a\u0a91\u0da1\u0e6d\u0f09\u0f26\u10ca\u1228\u12e1\u1415\u149d\u14c3\u14df\u1525\0\0\0\0\0\0\u156b\u16cd\u198d\u1c12\u1ddd\u1f7e\u2060\u21b0\u228d\u23c0\u23fb\u2442\u2824\u2912\u2d08\u2e48\u2fce\u3016\u32ba\u3639\u37ac\u38fe\u3a28\u3a71\u3ae0\u3b2e\u0800EMabcfglmnoprstu\\bfms\x7f\x84\x8b\x90\x95\x98\xa6\xb3\xb9\xc8\xcflig\u803b\xc6\u40c6P\u803b&\u4026cute\u803b\xc1\u40c1reve;\u4102\u0100iyx}rc\u803b\xc2\u40c2;\u4410r;\uc000\ud835\udd04rave\u803b\xc0\u40c0pha;\u4391acr;\u4100d;\u6a53\u0100gp\x9d\xa1on;\u4104f;\uc000\ud835\udd38plyFunction;\u6061ing\u803b\xc5\u40c5\u0100cs\xbe\xc3r;\uc000\ud835\udc9cign;\u6254ilde\u803b\xc3\u40c3ml\u803b\xc4\u40c4\u0400aceforsu\xe5\xfb\xfe\u0117\u011c\u0122\u0127\u012a\u0100cr\xea\xf2kslash;\u6216\u0176\xf6\xf8;\u6ae7ed;\u6306y;\u4411\u0180crt\u0105\u010b\u0114ause;\u6235noullis;\u612ca;\u4392r;\uc000\ud835\udd05pf;\uc000\ud835\udd39eve;\u42d8c\xf2\u0113mpeq;\u624e\u0700HOacdefhilorsu\u014d\u0151\u0156\u0180\u019e\u01a2\u01b5\u01b7\u01ba\u01dc\u0215\u0273\u0278\u027ecy;\u4427PY\u803b\xa9\u40a9\u0180cpy\u015d\u0162\u017aute;\u4106\u0100;i\u0167\u0168\u62d2talDifferentialD;\u6145leys;\u612d\u0200aeio\u0189\u018e\u0194\u0198ron;\u410cdil\u803b\xc7\u40c7rc;\u4108nint;\u6230ot;\u410a\u0100dn\u01a7\u01adilla;\u40b8terDot;\u40b7\xf2\u017fi;\u43a7rcle\u0200DMPT\u01c7\u01cb\u01d1\u01d6ot;\u6299inus;\u6296lus;\u6295imes;\u6297o\u0100cs\u01e2\u01f8kwiseContourIntegral;\u6232eCurly\u0100DQ\u0203\u020foubleQuote;\u601duote;\u6019\u0200lnpu\u021e\u0228\u0247\u0255on\u0100;e\u0225\u0226\u6237;\u6a74\u0180git\u022f\u0236\u023aruent;\u6261nt;\u622fourIntegral;\u622e\u0100fr\u024c\u024e;\u6102oduct;\u6210nterClockwiseContourIntegral;\u6233oss;\u6a2fcr;\uc000\ud835\udc9ep\u0100;C\u0284\u0285\u62d3ap;\u624d\u0580DJSZacefios\u02a0\u02ac\u02b0\u02b4\u02b8\u02cb\u02d7\u02e1\u02e6\u0333\u048d\u0100;o\u0179\u02a5trahd;\u6911cy;\u4402cy;\u4405cy;\u440f\u0180grs\u02bf\u02c4\u02c7ger;\u6021r;\u61a1hv;\u6ae4\u0100ay\u02d0\u02d5ron;\u410e;\u4414l\u0100;t\u02dd\u02de\u6207a;\u4394r;\uc000\ud835\udd07\u0100af\u02eb\u0327\u0100cm\u02f0\u0322ritical\u0200ADGT\u0300\u0306\u0316\u031ccute;\u40b4o\u0174\u030b\u030d;\u42d9bleAcute;\u42ddrave;\u4060ilde;\u42dcond;\u62c4ferentialD;\u6146\u0470\u033d\0\0\0\u0342\u0354\0\u0405f;\uc000\ud835\udd3b\u0180;DE\u0348\u0349\u034d\u40a8ot;\u60dcqual;\u6250ble\u0300CDLRUV\u0363\u0372\u0382\u03cf\u03e2\u03f8ontourIntegra\xec\u0239o\u0274\u0379\0\0\u037b\xbb\u0349nArrow;\u61d3\u0100eo\u0387\u03a4ft\u0180ART\u0390\u0396\u03a1rrow;\u61d0ightArrow;\u61d4e\xe5\u02cang\u0100LR\u03ab\u03c4eft\u0100AR\u03b3\u03b9rrow;\u67f8ightArrow;\u67faightArrow;\u67f9ight\u0100AT\u03d8\u03derrow;\u61d2ee;\u62a8p\u0241\u03e9\0\0\u03efrrow;\u61d1ownArrow;\u61d5erticalBar;\u6225n\u0300ABLRTa\u0412\u042a\u0430\u045e\u047f\u037crrow\u0180;BU\u041d\u041e\u0422\u6193ar;\u6913pArrow;\u61f5reve;\u4311eft\u02d2\u043a\0\u0446\0\u0450ightVector;\u6950eeVector;\u695eector\u0100;B\u0459\u045a\u61bdar;\u6956ight\u01d4\u0467\0\u0471eeVector;\u695fector\u0100;B\u047a\u047b\u61c1ar;\u6957ee\u0100;A\u0486\u0487\u62a4rrow;\u61a7\u0100ct\u0492\u0497r;\uc000\ud835\udc9frok;\u4110\u0800NTacdfglmopqstux\u04bd\u04c0\u04c4\u04cb\u04de\u04e2\u04e7\u04ee\u04f5\u0521\u052f\u0536\u0552\u055d\u0560\u0565G;\u414aH\u803b\xd0\u40d0cute\u803b\xc9\u40c9\u0180aiy\u04d2\u04d7\u04dcron;\u411arc\u803b\xca\u40ca;\u442dot;\u4116r;\uc000\ud835\udd08rave\u803b\xc8\u40c8ement;\u6208\u0100ap\u04fa\u04fecr;\u4112ty\u0253\u0506\0\0\u0512mallSquare;\u65fberySmallSquare;\u65ab\u0100gp\u0526\u052aon;\u4118f;\uc000\ud835\udd3csilon;\u4395u\u0100ai\u053c\u0549l\u0100;T\u0542\u0543\u6a75ilde;\u6242librium;\u61cc\u0100ci\u0557\u055ar;\u6130m;\u6a73a;\u4397ml\u803b\xcb\u40cb\u0100ip\u056a\u056fsts;\u6203onentialE;\u6147\u0280cfios\u0585\u0588\u058d\u05b2\u05ccy;\u4424r;\uc000\ud835\udd09lled\u0253\u0597\0\0\u05a3mallSquare;\u65fcerySmallSquare;\u65aa\u0370\u05ba\0\u05bf\0\0\u05c4f;\uc000\ud835\udd3dAll;\u6200riertrf;\u6131c\xf2\u05cb\u0600JTabcdfgorst\u05e8\u05ec\u05ef\u05fa\u0600\u0612\u0616\u061b\u061d\u0623\u066c\u0672cy;\u4403\u803b>\u403emma\u0100;d\u05f7\u05f8\u4393;\u43dcreve;\u411e\u0180eiy\u0607\u060c\u0610dil;\u4122rc;\u411c;\u4413ot;\u4120r;\uc000\ud835\udd0a;\u62d9pf;\uc000\ud835\udd3eeater\u0300EFGLST\u0635\u0644\u064e\u0656\u065b\u0666qual\u0100;L\u063e\u063f\u6265ess;\u62dbullEqual;\u6267reater;\u6aa2ess;\u6277lantEqual;\u6a7eilde;\u6273cr;\uc000\ud835\udca2;\u626b\u0400Aacfiosu\u0685\u068b\u0696\u069b\u069e\u06aa\u06be\u06caRDcy;\u442a\u0100ct\u0690\u0694ek;\u42c7;\u405eirc;\u4124r;\u610clbertSpace;\u610b\u01f0\u06af\0\u06b2f;\u610dizontalLine;\u6500\u0100ct\u06c3\u06c5\xf2\u06a9rok;\u4126mp\u0144\u06d0\u06d8ownHum\xf0\u012fqual;\u624f\u0700EJOacdfgmnostu\u06fa\u06fe\u0703\u0707\u070e\u071a\u071e\u0721\u0728\u0744\u0778\u078b\u078f\u0795cy;\u4415lig;\u4132cy;\u4401cute\u803b\xcd\u40cd\u0100iy\u0713\u0718rc\u803b\xce\u40ce;\u4418ot;\u4130r;\u6111rave\u803b\xcc\u40cc\u0180;ap\u0720\u072f\u073f\u0100cg\u0734\u0737r;\u412ainaryI;\u6148lie\xf3\u03dd\u01f4\u0749\0\u0762\u0100;e\u074d\u074e\u622c\u0100gr\u0753\u0758ral;\u622bsection;\u62c2isible\u0100CT\u076c\u0772omma;\u6063imes;\u6062\u0180gpt\u077f\u0783\u0788on;\u412ef;\uc000\ud835\udd40a;\u4399cr;\u6110ilde;\u4128\u01eb\u079a\0\u079ecy;\u4406l\u803b\xcf\u40cf\u0280cfosu\u07ac\u07b7\u07bc\u07c2\u07d0\u0100iy\u07b1\u07b5rc;\u4134;\u4419r;\uc000\ud835\udd0dpf;\uc000\ud835\udd41\u01e3\u07c7\0\u07ccr;\uc000\ud835\udca5rcy;\u4408kcy;\u4404\u0380HJacfos\u07e4\u07e8\u07ec\u07f1\u07fd\u0802\u0808cy;\u4425cy;\u440cppa;\u439a\u0100ey\u07f6\u07fbdil;\u4136;\u441ar;\uc000\ud835\udd0epf;\uc000\ud835\udd42cr;\uc000\ud835\udca6\u0580JTaceflmost\u0825\u0829\u082c\u0850\u0863\u09b3\u09b8\u09c7\u09cd\u0a37\u0a47cy;\u4409\u803b<\u403c\u0280cmnpr\u0837\u083c\u0841\u0844\u084dute;\u4139bda;\u439bg;\u67ealacetrf;\u6112r;\u619e\u0180aey\u0857\u085c\u0861ron;\u413ddil;\u413b;\u441b\u0100fs\u0868\u0970t\u0500ACDFRTUVar\u087e\u08a9\u08b1\u08e0\u08e6\u08fc\u092f\u095b\u0390\u096a\u0100nr\u0883\u088fgleBracket;\u67e8row\u0180;BR\u0899\u089a\u089e\u6190ar;\u61e4ightArrow;\u61c6eiling;\u6308o\u01f5\u08b7\0\u08c3bleBracket;\u67e6n\u01d4\u08c8\0\u08d2eeVector;\u6961ector\u0100;B\u08db\u08dc\u61c3ar;\u6959loor;\u630aight\u0100AV\u08ef\u08f5rrow;\u6194ector;\u694e\u0100er\u0901\u0917e\u0180;AV\u0909\u090a\u0910\u62a3rrow;\u61a4ector;\u695aiangle\u0180;BE\u0924\u0925\u0929\u62b2ar;\u69cfqual;\u62b4p\u0180DTV\u0937\u0942\u094cownVector;\u6951eeVector;\u6960ector\u0100;B\u0956\u0957\u61bfar;\u6958ector\u0100;B\u0965\u0966\u61bcar;\u6952ight\xe1\u039cs\u0300EFGLST\u097e\u098b\u0995\u099d\u09a2\u09adqualGreater;\u62daullEqual;\u6266reater;\u6276ess;\u6aa1lantEqual;\u6a7dilde;\u6272r;\uc000\ud835\udd0f\u0100;e\u09bd\u09be\u62d8ftarrow;\u61daidot;\u413f\u0180npw\u09d4\u0a16\u0a1bg\u0200LRlr\u09de\u09f7\u0a02\u0a10eft\u0100AR\u09e6\u09ecrrow;\u67f5ightArrow;\u67f7ightArrow;\u67f6eft\u0100ar\u03b3\u0a0aight\xe1\u03bfight\xe1\u03caf;\uc000\ud835\udd43er\u0100LR\u0a22\u0a2ceftArrow;\u6199ightArrow;\u6198\u0180cht\u0a3e\u0a40\u0a42\xf2\u084c;\u61b0rok;\u4141;\u626a\u0400acefiosu\u0a5a\u0a5d\u0a60\u0a77\u0a7c\u0a85\u0a8b\u0a8ep;\u6905y;\u441c\u0100dl\u0a65\u0a6fiumSpace;\u605flintrf;\u6133r;\uc000\ud835\udd10nusPlus;\u6213pf;\uc000\ud835\udd44c\xf2\u0a76;\u439c\u0480Jacefostu\u0aa3\u0aa7\u0aad\u0ac0\u0b14\u0b19\u0d91\u0d97\u0d9ecy;\u440acute;\u4143\u0180aey\u0ab4\u0ab9\u0aberon;\u4147dil;\u4145;\u441d\u0180gsw\u0ac7\u0af0\u0b0eative\u0180MTV\u0ad3\u0adf\u0ae8ediumSpace;\u600bhi\u0100cn\u0ae6\u0ad8\xeb\u0ad9eryThi\xee\u0ad9ted\u0100GL\u0af8\u0b06reaterGreate\xf2\u0673essLes\xf3\u0a48Line;\u400ar;\uc000\ud835\udd11\u0200Bnpt\u0b22\u0b28\u0b37\u0b3areak;\u6060BreakingSpace;\u40a0f;\u6115\u0680;CDEGHLNPRSTV\u0b55\u0b56\u0b6a\u0b7c\u0ba1\u0beb\u0c04\u0c5e\u0c84\u0ca6\u0cd8\u0d61\u0d85\u6aec\u0100ou\u0b5b\u0b64ngruent;\u6262pCap;\u626doubleVerticalBar;\u6226\u0180lqx\u0b83\u0b8a\u0b9bement;\u6209ual\u0100;T\u0b92\u0b93\u6260ilde;\uc000\u2242\u0338ists;\u6204reater\u0380;EFGLST\u0bb6\u0bb7\u0bbd\u0bc9\u0bd3\u0bd8\u0be5\u626fqual;\u6271ullEqual;\uc000\u2267\u0338reater;\uc000\u226b\u0338ess;\u6279lantEqual;\uc000\u2a7e\u0338ilde;\u6275ump\u0144\u0bf2\u0bfdownHump;\uc000\u224e\u0338qual;\uc000\u224f\u0338e\u0100fs\u0c0a\u0c27tTriangle\u0180;BE\u0c1a\u0c1b\u0c21\u62eaar;\uc000\u29cf\u0338qual;\u62ecs\u0300;EGLST\u0c35\u0c36\u0c3c\u0c44\u0c4b\u0c58\u626equal;\u6270reater;\u6278ess;\uc000\u226a\u0338lantEqual;\uc000\u2a7d\u0338ilde;\u6274ested\u0100GL\u0c68\u0c79reaterGreater;\uc000\u2aa2\u0338essLess;\uc000\u2aa1\u0338recedes\u0180;ES\u0c92\u0c93\u0c9b\u6280qual;\uc000\u2aaf\u0338lantEqual;\u62e0\u0100ei\u0cab\u0cb9verseElement;\u620cghtTriangle\u0180;BE\u0ccb\u0ccc\u0cd2\u62ebar;\uc000\u29d0\u0338qual;\u62ed\u0100qu\u0cdd\u0d0cuareSu\u0100bp\u0ce8\u0cf9set\u0100;E\u0cf0\u0cf3\uc000\u228f\u0338qual;\u62e2erset\u0100;E\u0d03\u0d06\uc000\u2290\u0338qual;\u62e3\u0180bcp\u0d13\u0d24\u0d4eset\u0100;E\u0d1b\u0d1e\uc000\u2282\u20d2qual;\u6288ceeds\u0200;EST\u0d32\u0d33\u0d3b\u0d46\u6281qual;\uc000\u2ab0\u0338lantEqual;\u62e1ilde;\uc000\u227f\u0338erset\u0100;E\u0d58\u0d5b\uc000\u2283\u20d2qual;\u6289ilde\u0200;EFT\u0d6e\u0d6f\u0d75\u0d7f\u6241qual;\u6244ullEqual;\u6247ilde;\u6249erticalBar;\u6224cr;\uc000\ud835\udca9ilde\u803b\xd1\u40d1;\u439d\u0700Eacdfgmoprstuv\u0dbd\u0dc2\u0dc9\u0dd5\u0ddb\u0de0\u0de7\u0dfc\u0e02\u0e20\u0e22\u0e32\u0e3f\u0e44lig;\u4152cute\u803b\xd3\u40d3\u0100iy\u0dce\u0dd3rc\u803b\xd4\u40d4;\u441eblac;\u4150r;\uc000\ud835\udd12rave\u803b\xd2\u40d2\u0180aei\u0dee\u0df2\u0df6cr;\u414cga;\u43a9cron;\u439fpf;\uc000\ud835\udd46enCurly\u0100DQ\u0e0e\u0e1aoubleQuote;\u601cuote;\u6018;\u6a54\u0100cl\u0e27\u0e2cr;\uc000\ud835\udcaaash\u803b\xd8\u40d8i\u016c\u0e37\u0e3cde\u803b\xd5\u40d5es;\u6a37ml\u803b\xd6\u40d6er\u0100BP\u0e4b\u0e60\u0100ar\u0e50\u0e53r;\u603eac\u0100ek\u0e5a\u0e5c;\u63deet;\u63b4arenthesis;\u63dc\u0480acfhilors\u0e7f\u0e87\u0e8a\u0e8f\u0e92\u0e94\u0e9d\u0eb0\u0efcrtialD;\u6202y;\u441fr;\uc000\ud835\udd13i;\u43a6;\u43a0usMinus;\u40b1\u0100ip\u0ea2\u0eadncareplan\xe5\u069df;\u6119\u0200;eio\u0eb9\u0eba\u0ee0\u0ee4\u6abbcedes\u0200;EST\u0ec8\u0ec9\u0ecf\u0eda\u627aqual;\u6aaflantEqual;\u627cilde;\u627eme;\u6033\u0100dp\u0ee9\u0eeeuct;\u620fortion\u0100;a\u0225\u0ef9l;\u621d\u0100ci\u0f01\u0f06r;\uc000\ud835\udcab;\u43a8\u0200Ufos\u0f11\u0f16\u0f1b\u0f1fOT\u803b\"\u4022r;\uc000\ud835\udd14pf;\u611acr;\uc000\ud835\udcac\u0600BEacefhiorsu\u0f3e\u0f43\u0f47\u0f60\u0f73\u0fa7\u0faa\u0fad\u1096\u10a9\u10b4\u10bearr;\u6910G\u803b\xae\u40ae\u0180cnr\u0f4e\u0f53\u0f56ute;\u4154g;\u67ebr\u0100;t\u0f5c\u0f5d\u61a0l;\u6916\u0180aey\u0f67\u0f6c\u0f71ron;\u4158dil;\u4156;\u4420\u0100;v\u0f78\u0f79\u611cerse\u0100EU\u0f82\u0f99\u0100lq\u0f87\u0f8eement;\u620builibrium;\u61cbpEquilibrium;\u696fr\xbb\u0f79o;\u43a1ght\u0400ACDFTUVa\u0fc1\u0feb\u0ff3\u1022\u1028\u105b\u1087\u03d8\u0100nr\u0fc6\u0fd2gleBracket;\u67e9row\u0180;BL\u0fdc\u0fdd\u0fe1\u6192ar;\u61e5eftArrow;\u61c4eiling;\u6309o\u01f5\u0ff9\0\u1005bleBracket;\u67e7n\u01d4\u100a\0\u1014eeVector;\u695dector\u0100;B\u101d\u101e\u61c2ar;\u6955loor;\u630b\u0100er\u102d\u1043e\u0180;AV\u1035\u1036\u103c\u62a2rrow;\u61a6ector;\u695biangle\u0180;BE\u1050\u1051\u1055\u62b3ar;\u69d0qual;\u62b5p\u0180DTV\u1063\u106e\u1078ownVector;\u694feeVector;\u695cector\u0100;B\u1082\u1083\u61bear;\u6954ector\u0100;B\u1091\u1092\u61c0ar;\u6953\u0100pu\u109b\u109ef;\u611dndImplies;\u6970ightarrow;\u61db\u0100ch\u10b9\u10bcr;\u611b;\u61b1leDelayed;\u69f4\u0680HOacfhimoqstu\u10e4\u10f1\u10f7\u10fd\u1119\u111e\u1151\u1156\u1161\u1167\u11b5\u11bb\u11bf\u0100Cc\u10e9\u10eeHcy;\u4429y;\u4428FTcy;\u442ccute;\u415a\u0280;aeiy\u1108\u1109\u110e\u1113\u1117\u6abcron;\u4160dil;\u415erc;\u415c;\u4421r;\uc000\ud835\udd16ort\u0200DLRU\u112a\u1134\u113e\u1149ownArrow\xbb\u041eeftArrow\xbb\u089aightArrow\xbb\u0fddpArrow;\u6191gma;\u43a3allCircle;\u6218pf;\uc000\ud835\udd4a\u0272\u116d\0\0\u1170t;\u621aare\u0200;ISU\u117b\u117c\u1189\u11af\u65a1ntersection;\u6293u\u0100bp\u118f\u119eset\u0100;E\u1197\u1198\u628fqual;\u6291erset\u0100;E\u11a8\u11a9\u6290qual;\u6292nion;\u6294cr;\uc000\ud835\udcaear;\u62c6\u0200bcmp\u11c8\u11db\u1209\u120b\u0100;s\u11cd\u11ce\u62d0et\u0100;E\u11cd\u11d5qual;\u6286\u0100ch\u11e0\u1205eeds\u0200;EST\u11ed\u11ee\u11f4\u11ff\u627bqual;\u6ab0lantEqual;\u627dilde;\u627fTh\xe1\u0f8c;\u6211\u0180;es\u1212\u1213\u1223\u62d1rset\u0100;E\u121c\u121d\u6283qual;\u6287et\xbb\u1213\u0580HRSacfhiors\u123e\u1244\u1249\u1255\u125e\u1271\u1276\u129f\u12c2\u12c8\u12d1ORN\u803b\xde\u40deADE;\u6122\u0100Hc\u124e\u1252cy;\u440by;\u4426\u0100bu\u125a\u125c;\u4009;\u43a4\u0180aey\u1265\u126a\u126fron;\u4164dil;\u4162;\u4422r;\uc000\ud835\udd17\u0100ei\u127b\u1289\u01f2\u1280\0\u1287efore;\u6234a;\u4398\u0100cn\u128e\u1298kSpace;\uc000\u205f\u200aSpace;\u6009lde\u0200;EFT\u12ab\u12ac\u12b2\u12bc\u623cqual;\u6243ullEqual;\u6245ilde;\u6248pf;\uc000\ud835\udd4bipleDot;\u60db\u0100ct\u12d6\u12dbr;\uc000\ud835\udcafrok;\u4166\u0ae1\u12f7\u130e\u131a\u1326\0\u132c\u1331\0\0\0\0\0\u1338\u133d\u1377\u1385\0\u13ff\u1404\u140a\u1410\u0100cr\u12fb\u1301ute\u803b\xda\u40dar\u0100;o\u1307\u1308\u619fcir;\u6949r\u01e3\u1313\0\u1316y;\u440eve;\u416c\u0100iy\u131e\u1323rc\u803b\xdb\u40db;\u4423blac;\u4170r;\uc000\ud835\udd18rave\u803b\xd9\u40d9acr;\u416a\u0100di\u1341\u1369er\u0100BP\u1348\u135d\u0100ar\u134d\u1350r;\u405fac\u0100ek\u1357\u1359;\u63dfet;\u63b5arenthesis;\u63ddon\u0100;P\u1370\u1371\u62c3lus;\u628e\u0100gp\u137b\u137fon;\u4172f;\uc000\ud835\udd4c\u0400ADETadps\u1395\u13ae\u13b8\u13c4\u03e8\u13d2\u13d7\u13f3rrow\u0180;BD\u1150\u13a0\u13a4ar;\u6912ownArrow;\u61c5ownArrow;\u6195quilibrium;\u696eee\u0100;A\u13cb\u13cc\u62a5rrow;\u61a5own\xe1\u03f3er\u0100LR\u13de\u13e8eftArrow;\u6196ightArrow;\u6197i\u0100;l\u13f9\u13fa\u43d2on;\u43a5ing;\u416ecr;\uc000\ud835\udcb0ilde;\u4168ml\u803b\xdc\u40dc\u0480Dbcdefosv\u1427\u142c\u1430\u1433\u143e\u1485\u148a\u1490\u1496ash;\u62abar;\u6aeby;\u4412ash\u0100;l\u143b\u143c\u62a9;\u6ae6\u0100er\u1443\u1445;\u62c1\u0180bty\u144c\u1450\u147aar;\u6016\u0100;i\u144f\u1455cal\u0200BLST\u1461\u1465\u146a\u1474ar;\u6223ine;\u407ceparator;\u6758ilde;\u6240ThinSpace;\u600ar;\uc000\ud835\udd19pf;\uc000\ud835\udd4dcr;\uc000\ud835\udcb1dash;\u62aa\u0280cefos\u14a7\u14ac\u14b1\u14b6\u14bcirc;\u4174dge;\u62c0r;\uc000\ud835\udd1apf;\uc000\ud835\udd4ecr;\uc000\ud835\udcb2\u0200fios\u14cb\u14d0\u14d2\u14d8r;\uc000\ud835\udd1b;\u439epf;\uc000\ud835\udd4fcr;\uc000\ud835\udcb3\u0480AIUacfosu\u14f1\u14f5\u14f9\u14fd\u1504\u150f\u1514\u151a\u1520cy;\u442fcy;\u4407cy;\u442ecute\u803b\xdd\u40dd\u0100iy\u1509\u150drc;\u4176;\u442br;\uc000\ud835\udd1cpf;\uc000\ud835\udd50cr;\uc000\ud835\udcb4ml;\u4178\u0400Hacdefos\u1535\u1539\u153f\u154b\u154f\u155d\u1560\u1564cy;\u4416cute;\u4179\u0100ay\u1544\u1549ron;\u417d;\u4417ot;\u417b\u01f2\u1554\0\u155boWidt\xe8\u0ad9a;\u4396r;\u6128pf;\u6124cr;\uc000\ud835\udcb5\u0be1\u1583\u158a\u1590\0\u15b0\u15b6\u15bf\0\0\0\0\u15c6\u15db\u15eb\u165f\u166d\0\u1695\u169b\u16b2\u16b9\0\u16becute\u803b\xe1\u40e1reve;\u4103\u0300;Ediuy\u159c\u159d\u15a1\u15a3\u15a8\u15ad\u623e;\uc000\u223e\u0333;\u623frc\u803b\xe2\u40e2te\u80bb\xb4\u0306;\u4430lig\u803b\xe6\u40e6\u0100;r\xb2\u15ba;\uc000\ud835\udd1erave\u803b\xe0\u40e0\u0100ep\u15ca\u15d6\u0100fp\u15cf\u15d4sym;\u6135\xe8\u15d3ha;\u43b1\u0100ap\u15dfc\u0100cl\u15e4\u15e7r;\u4101g;\u6a3f\u0264\u15f0\0\0\u160a\u0280;adsv\u15fa\u15fb\u15ff\u1601\u1607\u6227nd;\u6a55;\u6a5clope;\u6a58;\u6a5a\u0380;elmrsz\u1618\u1619\u161b\u161e\u163f\u164f\u1659\u6220;\u69a4e\xbb\u1619sd\u0100;a\u1625\u1626\u6221\u0461\u1630\u1632\u1634\u1636\u1638\u163a\u163c\u163e;\u69a8;\u69a9;\u69aa;\u69ab;\u69ac;\u69ad;\u69ae;\u69aft\u0100;v\u1645\u1646\u621fb\u0100;d\u164c\u164d\u62be;\u699d\u0100pt\u1654\u1657h;\u6222\xbb\xb9arr;\u637c\u0100gp\u1663\u1667on;\u4105f;\uc000\ud835\udd52\u0380;Eaeiop\u12c1\u167b\u167d\u1682\u1684\u1687\u168a;\u6a70cir;\u6a6f;\u624ad;\u624bs;\u4027rox\u0100;e\u12c1\u1692\xf1\u1683ing\u803b\xe5\u40e5\u0180cty\u16a1\u16a6\u16a8r;\uc000\ud835\udcb6;\u402amp\u0100;e\u12c1\u16af\xf1\u0288ilde\u803b\xe3\u40e3ml\u803b\xe4\u40e4\u0100ci\u16c2\u16c8onin\xf4\u0272nt;\u6a11\u0800Nabcdefiklnoprsu\u16ed\u16f1\u1730\u173c\u1743\u1748\u1778\u177d\u17e0\u17e6\u1839\u1850\u170d\u193d\u1948\u1970ot;\u6aed\u0100cr\u16f6\u171ek\u0200ceps\u1700\u1705\u170d\u1713ong;\u624cpsilon;\u43f6rime;\u6035im\u0100;e\u171a\u171b\u623dq;\u62cd\u0176\u1722\u1726ee;\u62bded\u0100;g\u172c\u172d\u6305e\xbb\u172drk\u0100;t\u135c\u1737brk;\u63b6\u0100oy\u1701\u1741;\u4431quo;\u601e\u0280cmprt\u1753\u175b\u1761\u1764\u1768aus\u0100;e\u010a\u0109ptyv;\u69b0s\xe9\u170cno\xf5\u0113\u0180ahw\u176f\u1771\u1773;\u43b2;\u6136een;\u626cr;\uc000\ud835\udd1fg\u0380costuvw\u178d\u179d\u17b3\u17c1\u17d5\u17db\u17de\u0180aiu\u1794\u1796\u179a\xf0\u0760rc;\u65efp\xbb\u1371\u0180dpt\u17a4\u17a8\u17adot;\u6a00lus;\u6a01imes;\u6a02\u0271\u17b9\0\0\u17becup;\u6a06ar;\u6605riangle\u0100du\u17cd\u17d2own;\u65bdp;\u65b3plus;\u6a04e\xe5\u1444\xe5\u14adarow;\u690d\u0180ako\u17ed\u1826\u1835\u0100cn\u17f2\u1823k\u0180lst\u17fa\u05ab\u1802ozenge;\u69ebriangle\u0200;dlr\u1812\u1813\u1818\u181d\u65b4own;\u65beeft;\u65c2ight;\u65b8k;\u6423\u01b1\u182b\0\u1833\u01b2\u182f\0\u1831;\u6592;\u65914;\u6593ck;\u6588\u0100eo\u183e\u184d\u0100;q\u1843\u1846\uc000=\u20e5uiv;\uc000\u2261\u20e5t;\u6310\u0200ptwx\u1859\u185e\u1867\u186cf;\uc000\ud835\udd53\u0100;t\u13cb\u1863om\xbb\u13cctie;\u62c8\u0600DHUVbdhmptuv\u1885\u1896\u18aa\u18bb\u18d7\u18db\u18ec\u18ff\u1905\u190a\u1910\u1921\u0200LRlr\u188e\u1890\u1892\u1894;\u6557;\u6554;\u6556;\u6553\u0280;DUdu\u18a1\u18a2\u18a4\u18a6\u18a8\u6550;\u6566;\u6569;\u6564;\u6567\u0200LRlr\u18b3\u18b5\u18b7\u18b9;\u655d;\u655a;\u655c;\u6559\u0380;HLRhlr\u18ca\u18cb\u18cd\u18cf\u18d1\u18d3\u18d5\u6551;\u656c;\u6563;\u6560;\u656b;\u6562;\u655fox;\u69c9\u0200LRlr\u18e4\u18e6\u18e8\u18ea;\u6555;\u6552;\u6510;\u650c\u0280;DUdu\u06bd\u18f7\u18f9\u18fb\u18fd;\u6565;\u6568;\u652c;\u6534inus;\u629flus;\u629eimes;\u62a0\u0200LRlr\u1919\u191b\u191d\u191f;\u655b;\u6558;\u6518;\u6514\u0380;HLRhlr\u1930\u1931\u1933\u1935\u1937\u1939\u193b\u6502;\u656a;\u6561;\u655e;\u653c;\u6524;\u651c\u0100ev\u0123\u1942bar\u803b\xa6\u40a6\u0200ceio\u1951\u1956\u195a\u1960r;\uc000\ud835\udcb7mi;\u604fm\u0100;e\u171a\u171cl\u0180;bh\u1968\u1969\u196b\u405c;\u69c5sub;\u67c8\u016c\u1974\u197el\u0100;e\u1979\u197a\u6022t\xbb\u197ap\u0180;Ee\u012f\u1985\u1987;\u6aae\u0100;q\u06dc\u06db\u0ce1\u19a7\0\u19e8\u1a11\u1a15\u1a32\0\u1a37\u1a50\0\0\u1ab4\0\0\u1ac1\0\0\u1b21\u1b2e\u1b4d\u1b52\0\u1bfd\0\u1c0c\u0180cpr\u19ad\u19b2\u19ddute;\u4107\u0300;abcds\u19bf\u19c0\u19c4\u19ca\u19d5\u19d9\u6229nd;\u6a44rcup;\u6a49\u0100au\u19cf\u19d2p;\u6a4bp;\u6a47ot;\u6a40;\uc000\u2229\ufe00\u0100eo\u19e2\u19e5t;\u6041\xee\u0693\u0200aeiu\u19f0\u19fb\u1a01\u1a05\u01f0\u19f5\0\u19f8s;\u6a4don;\u410ddil\u803b\xe7\u40e7rc;\u4109ps\u0100;s\u1a0c\u1a0d\u6a4cm;\u6a50ot;\u410b\u0180dmn\u1a1b\u1a20\u1a26il\u80bb\xb8\u01adptyv;\u69b2t\u8100\xa2;e\u1a2d\u1a2e\u40a2r\xe4\u01b2r;\uc000\ud835\udd20\u0180cei\u1a3d\u1a40\u1a4dy;\u4447ck\u0100;m\u1a47\u1a48\u6713ark\xbb\u1a48;\u43c7r\u0380;Ecefms\u1a5f\u1a60\u1a62\u1a6b\u1aa4\u1aaa\u1aae\u65cb;\u69c3\u0180;el\u1a69\u1a6a\u1a6d\u42c6q;\u6257e\u0261\u1a74\0\0\u1a88rrow\u0100lr\u1a7c\u1a81eft;\u61baight;\u61bb\u0280RSacd\u1a92\u1a94\u1a96\u1a9a\u1a9f\xbb\u0f47;\u64c8st;\u629birc;\u629aash;\u629dnint;\u6a10id;\u6aefcir;\u69c2ubs\u0100;u\u1abb\u1abc\u6663it\xbb\u1abc\u02ec\u1ac7\u1ad4\u1afa\0\u1b0aon\u0100;e\u1acd\u1ace\u403a\u0100;q\xc7\xc6\u026d\u1ad9\0\0\u1ae2a\u0100;t\u1ade\u1adf\u402c;\u4040\u0180;fl\u1ae8\u1ae9\u1aeb\u6201\xee\u1160e\u0100mx\u1af1\u1af6ent\xbb\u1ae9e\xf3\u024d\u01e7\u1afe\0\u1b07\u0100;d\u12bb\u1b02ot;\u6a6dn\xf4\u0246\u0180fry\u1b10\u1b14\u1b17;\uc000\ud835\udd54o\xe4\u0254\u8100\xa9;s\u0155\u1b1dr;\u6117\u0100ao\u1b25\u1b29rr;\u61b5ss;\u6717\u0100cu\u1b32\u1b37r;\uc000\ud835\udcb8\u0100bp\u1b3c\u1b44\u0100;e\u1b41\u1b42\u6acf;\u6ad1\u0100;e\u1b49\u1b4a\u6ad0;\u6ad2dot;\u62ef\u0380delprvw\u1b60\u1b6c\u1b77\u1b82\u1bac\u1bd4\u1bf9arr\u0100lr\u1b68\u1b6a;\u6938;\u6935\u0270\u1b72\0\0\u1b75r;\u62dec;\u62dfarr\u0100;p\u1b7f\u1b80\u61b6;\u693d\u0300;bcdos\u1b8f\u1b90\u1b96\u1ba1\u1ba5\u1ba8\u622arcap;\u6a48\u0100au\u1b9b\u1b9ep;\u6a46p;\u6a4aot;\u628dr;\u6a45;\uc000\u222a\ufe00\u0200alrv\u1bb5\u1bbf\u1bde\u1be3rr\u0100;m\u1bbc\u1bbd\u61b7;\u693cy\u0180evw\u1bc7\u1bd4\u1bd8q\u0270\u1bce\0\0\u1bd2re\xe3\u1b73u\xe3\u1b75ee;\u62ceedge;\u62cfen\u803b\xa4\u40a4earrow\u0100lr\u1bee\u1bf3eft\xbb\u1b80ight\xbb\u1bbde\xe4\u1bdd\u0100ci\u1c01\u1c07onin\xf4\u01f7nt;\u6231lcty;\u632d\u0980AHabcdefhijlorstuwz\u1c38\u1c3b\u1c3f\u1c5d\u1c69\u1c75\u1c8a\u1c9e\u1cac\u1cb7\u1cfb\u1cff\u1d0d\u1d7b\u1d91\u1dab\u1dbb\u1dc6\u1dcdr\xf2\u0381ar;\u6965\u0200glrs\u1c48\u1c4d\u1c52\u1c54ger;\u6020eth;\u6138\xf2\u1133h\u0100;v\u1c5a\u1c5b\u6010\xbb\u090a\u016b\u1c61\u1c67arow;\u690fa\xe3\u0315\u0100ay\u1c6e\u1c73ron;\u410f;\u4434\u0180;ao\u0332\u1c7c\u1c84\u0100gr\u02bf\u1c81r;\u61catseq;\u6a77\u0180glm\u1c91\u1c94\u1c98\u803b\xb0\u40b0ta;\u43b4ptyv;\u69b1\u0100ir\u1ca3\u1ca8sht;\u697f;\uc000\ud835\udd21ar\u0100lr\u1cb3\u1cb5\xbb\u08dc\xbb\u101e\u0280aegsv\u1cc2\u0378\u1cd6\u1cdc\u1ce0m\u0180;os\u0326\u1cca\u1cd4nd\u0100;s\u0326\u1cd1uit;\u6666amma;\u43ddin;\u62f2\u0180;io\u1ce7\u1ce8\u1cf8\u40f7de\u8100\xf7;o\u1ce7\u1cf0ntimes;\u62c7n\xf8\u1cf7cy;\u4452c\u026f\u1d06\0\0\u1d0arn;\u631eop;\u630d\u0280lptuw\u1d18\u1d1d\u1d22\u1d49\u1d55lar;\u4024f;\uc000\ud835\udd55\u0280;emps\u030b\u1d2d\u1d37\u1d3d\u1d42q\u0100;d\u0352\u1d33ot;\u6251inus;\u6238lus;\u6214quare;\u62a1blebarwedg\xe5\xfan\u0180adh\u112e\u1d5d\u1d67ownarrow\xf3\u1c83arpoon\u0100lr\u1d72\u1d76ef\xf4\u1cb4igh\xf4\u1cb6\u0162\u1d7f\u1d85karo\xf7\u0f42\u026f\u1d8a\0\0\u1d8ern;\u631fop;\u630c\u0180cot\u1d98\u1da3\u1da6\u0100ry\u1d9d\u1da1;\uc000\ud835\udcb9;\u4455l;\u69f6rok;\u4111\u0100dr\u1db0\u1db4ot;\u62f1i\u0100;f\u1dba\u1816\u65bf\u0100ah\u1dc0\u1dc3r\xf2\u0429a\xf2\u0fa6angle;\u69a6\u0100ci\u1dd2\u1dd5y;\u445fgrarr;\u67ff\u0900Dacdefglmnopqrstux\u1e01\u1e09\u1e19\u1e38\u0578\u1e3c\u1e49\u1e61\u1e7e\u1ea5\u1eaf\u1ebd\u1ee1\u1f2a\u1f37\u1f44\u1f4e\u1f5a\u0100Do\u1e06\u1d34o\xf4\u1c89\u0100cs\u1e0e\u1e14ute\u803b\xe9\u40e9ter;\u6a6e\u0200aioy\u1e22\u1e27\u1e31\u1e36ron;\u411br\u0100;c\u1e2d\u1e2e\u6256\u803b\xea\u40ealon;\u6255;\u444dot;\u4117\u0100Dr\u1e41\u1e45ot;\u6252;\uc000\ud835\udd22\u0180;rs\u1e50\u1e51\u1e57\u6a9aave\u803b\xe8\u40e8\u0100;d\u1e5c\u1e5d\u6a96ot;\u6a98\u0200;ils\u1e6a\u1e6b\u1e72\u1e74\u6a99nters;\u63e7;\u6113\u0100;d\u1e79\u1e7a\u6a95ot;\u6a97\u0180aps\u1e85\u1e89\u1e97cr;\u4113ty\u0180;sv\u1e92\u1e93\u1e95\u6205et\xbb\u1e93p\u01001;\u1e9d\u1ea4\u0133\u1ea1\u1ea3;\u6004;\u6005\u6003\u0100gs\u1eaa\u1eac;\u414bp;\u6002\u0100gp\u1eb4\u1eb8on;\u4119f;\uc000\ud835\udd56\u0180als\u1ec4\u1ece\u1ed2r\u0100;s\u1eca\u1ecb\u62d5l;\u69e3us;\u6a71i\u0180;lv\u1eda\u1edb\u1edf\u43b5on\xbb\u1edb;\u43f5\u0200csuv\u1eea\u1ef3\u1f0b\u1f23\u0100io\u1eef\u1e31rc\xbb\u1e2e\u0269\u1ef9\0\0\u1efb\xed\u0548ant\u0100gl\u1f02\u1f06tr\xbb\u1e5dess\xbb\u1e7a\u0180aei\u1f12\u1f16\u1f1als;\u403dst;\u625fv\u0100;D\u0235\u1f20D;\u6a78parsl;\u69e5\u0100Da\u1f2f\u1f33ot;\u6253rr;\u6971\u0180cdi\u1f3e\u1f41\u1ef8r;\u612fo\xf4\u0352\u0100ah\u1f49\u1f4b;\u43b7\u803b\xf0\u40f0\u0100mr\u1f53\u1f57l\u803b\xeb\u40ebo;\u60ac\u0180cip\u1f61\u1f64\u1f67l;\u4021s\xf4\u056e\u0100eo\u1f6c\u1f74ctatio\xee\u0559nential\xe5\u0579\u09e1\u1f92\0\u1f9e\0\u1fa1\u1fa7\0\0\u1fc6\u1fcc\0\u1fd3\0\u1fe6\u1fea\u2000\0\u2008\u205allingdotse\xf1\u1e44y;\u4444male;\u6640\u0180ilr\u1fad\u1fb3\u1fc1lig;\u8000\ufb03\u0269\u1fb9\0\0\u1fbdg;\u8000\ufb00ig;\u8000\ufb04;\uc000\ud835\udd23lig;\u8000\ufb01lig;\uc000fj\u0180alt\u1fd9\u1fdc\u1fe1t;\u666dig;\u8000\ufb02ns;\u65b1of;\u4192\u01f0\u1fee\0\u1ff3f;\uc000\ud835\udd57\u0100ak\u05bf\u1ff7\u0100;v\u1ffc\u1ffd\u62d4;\u6ad9artint;\u6a0d\u0100ao\u200c\u2055\u0100cs\u2011\u2052\u03b1\u201a\u2030\u2038\u2045\u2048\0\u2050\u03b2\u2022\u2025\u2027\u202a\u202c\0\u202e\u803b\xbd\u40bd;\u6153\u803b\xbc\u40bc;\u6155;\u6159;\u615b\u01b3\u2034\0\u2036;\u6154;\u6156\u02b4\u203e\u2041\0\0\u2043\u803b\xbe\u40be;\u6157;\u615c5;\u6158\u01b6\u204c\0\u204e;\u615a;\u615d8;\u615el;\u6044wn;\u6322cr;\uc000\ud835\udcbb\u0880Eabcdefgijlnorstv\u2082\u2089\u209f\u20a5\u20b0\u20b4\u20f0\u20f5\u20fa\u20ff\u2103\u2112\u2138\u0317\u213e\u2152\u219e\u0100;l\u064d\u2087;\u6a8c\u0180cmp\u2090\u2095\u209dute;\u41f5ma\u0100;d\u209c\u1cda\u43b3;\u6a86reve;\u411f\u0100iy\u20aa\u20aerc;\u411d;\u4433ot;\u4121\u0200;lqs\u063e\u0642\u20bd\u20c9\u0180;qs\u063e\u064c\u20c4lan\xf4\u0665\u0200;cdl\u0665\u20d2\u20d5\u20e5c;\u6aa9ot\u0100;o\u20dc\u20dd\u6a80\u0100;l\u20e2\u20e3\u6a82;\u6a84\u0100;e\u20ea\u20ed\uc000\u22db\ufe00s;\u6a94r;\uc000\ud835\udd24\u0100;g\u0673\u061bmel;\u6137cy;\u4453\u0200;Eaj\u065a\u210c\u210e\u2110;\u6a92;\u6aa5;\u6aa4\u0200Eaes\u211b\u211d\u2129\u2134;\u6269p\u0100;p\u2123\u2124\u6a8arox\xbb\u2124\u0100;q\u212e\u212f\u6a88\u0100;q\u212e\u211bim;\u62e7pf;\uc000\ud835\udd58\u0100ci\u2143\u2146r;\u610am\u0180;el\u066b\u214e\u2150;\u6a8e;\u6a90\u8300>;cdlqr\u05ee\u2160\u216a\u216e\u2173\u2179\u0100ci\u2165\u2167;\u6aa7r;\u6a7aot;\u62d7Par;\u6995uest;\u6a7c\u0280adels\u2184\u216a\u2190\u0656\u219b\u01f0\u2189\0\u218epro\xf8\u209er;\u6978q\u0100lq\u063f\u2196les\xf3\u2088i\xed\u066b\u0100en\u21a3\u21adrtneqq;\uc000\u2269\ufe00\xc5\u21aa\u0500Aabcefkosy\u21c4\u21c7\u21f1\u21f5\u21fa\u2218\u221d\u222f\u2268\u227dr\xf2\u03a0\u0200ilmr\u21d0\u21d4\u21d7\u21dbrs\xf0\u1484f\xbb\u2024il\xf4\u06a9\u0100dr\u21e0\u21e4cy;\u444a\u0180;cw\u08f4\u21eb\u21efir;\u6948;\u61adar;\u610firc;\u4125\u0180alr\u2201\u220e\u2213rts\u0100;u\u2209\u220a\u6665it\xbb\u220alip;\u6026con;\u62b9r;\uc000\ud835\udd25s\u0100ew\u2223\u2229arow;\u6925arow;\u6926\u0280amopr\u223a\u223e\u2243\u225e\u2263rr;\u61fftht;\u623bk\u0100lr\u2249\u2253eftarrow;\u61a9ightarrow;\u61aaf;\uc000\ud835\udd59bar;\u6015\u0180clt\u226f\u2274\u2278r;\uc000\ud835\udcbdas\xe8\u21f4rok;\u4127\u0100bp\u2282\u2287ull;\u6043hen\xbb\u1c5b\u0ae1\u22a3\0\u22aa\0\u22b8\u22c5\u22ce\0\u22d5\u22f3\0\0\u22f8\u2322\u2367\u2362\u237f\0\u2386\u23aa\u23b4cute\u803b\xed\u40ed\u0180;iy\u0771\u22b0\u22b5rc\u803b\xee\u40ee;\u4438\u0100cx\u22bc\u22bfy;\u4435cl\u803b\xa1\u40a1\u0100fr\u039f\u22c9;\uc000\ud835\udd26rave\u803b\xec\u40ec\u0200;ino\u073e\u22dd\u22e9\u22ee\u0100in\u22e2\u22e6nt;\u6a0ct;\u622dfin;\u69dcta;\u6129lig;\u4133\u0180aop\u22fe\u231a\u231d\u0180cgt\u2305\u2308\u2317r;\u412b\u0180elp\u071f\u230f\u2313in\xe5\u078ear\xf4\u0720h;\u4131f;\u62b7ed;\u41b5\u0280;cfot\u04f4\u232c\u2331\u233d\u2341are;\u6105in\u0100;t\u2338\u2339\u621eie;\u69dddo\xf4\u2319\u0280;celp\u0757\u234c\u2350\u235b\u2361al;\u62ba\u0100gr\u2355\u2359er\xf3\u1563\xe3\u234darhk;\u6a17rod;\u6a3c\u0200cgpt\u236f\u2372\u2376\u237by;\u4451on;\u412ff;\uc000\ud835\udd5aa;\u43b9uest\u803b\xbf\u40bf\u0100ci\u238a\u238fr;\uc000\ud835\udcben\u0280;Edsv\u04f4\u239b\u239d\u23a1\u04f3;\u62f9ot;\u62f5\u0100;v\u23a6\u23a7\u62f4;\u62f3\u0100;i\u0777\u23aelde;\u4129\u01eb\u23b8\0\u23bccy;\u4456l\u803b\xef\u40ef\u0300cfmosu\u23cc\u23d7\u23dc\u23e1\u23e7\u23f5\u0100iy\u23d1\u23d5rc;\u4135;\u4439r;\uc000\ud835\udd27ath;\u4237pf;\uc000\ud835\udd5b\u01e3\u23ec\0\u23f1r;\uc000\ud835\udcbfrcy;\u4458kcy;\u4454\u0400acfghjos\u240b\u2416\u2422\u2427\u242d\u2431\u2435\u243bppa\u0100;v\u2413\u2414\u43ba;\u43f0\u0100ey\u241b\u2420dil;\u4137;\u443ar;\uc000\ud835\udd28reen;\u4138cy;\u4445cy;\u445cpf;\uc000\ud835\udd5ccr;\uc000\ud835\udcc0\u0b80ABEHabcdefghjlmnoprstuv\u2470\u2481\u2486\u248d\u2491\u250e\u253d\u255a\u2580\u264e\u265e\u2665\u2679\u267d\u269a\u26b2\u26d8\u275d\u2768\u278b\u27c0\u2801\u2812\u0180art\u2477\u247a\u247cr\xf2\u09c6\xf2\u0395ail;\u691barr;\u690e\u0100;g\u0994\u248b;\u6a8bar;\u6962\u0963\u24a5\0\u24aa\0\u24b1\0\0\0\0\0\u24b5\u24ba\0\u24c6\u24c8\u24cd\0\u24f9ute;\u413amptyv;\u69b4ra\xee\u084cbda;\u43bbg\u0180;dl\u088e\u24c1\u24c3;\u6991\xe5\u088e;\u6a85uo\u803b\xab\u40abr\u0400;bfhlpst\u0899\u24de\u24e6\u24e9\u24eb\u24ee\u24f1\u24f5\u0100;f\u089d\u24e3s;\u691fs;\u691d\xeb\u2252p;\u61abl;\u6939im;\u6973l;\u61a2\u0180;ae\u24ff\u2500\u2504\u6aabil;\u6919\u0100;s\u2509\u250a\u6aad;\uc000\u2aad\ufe00\u0180abr\u2515\u2519\u251drr;\u690crk;\u6772\u0100ak\u2522\u252cc\u0100ek\u2528\u252a;\u407b;\u405b\u0100es\u2531\u2533;\u698bl\u0100du\u2539\u253b;\u698f;\u698d\u0200aeuy\u2546\u254b\u2556\u2558ron;\u413e\u0100di\u2550\u2554il;\u413c\xec\u08b0\xe2\u2529;\u443b\u0200cqrs\u2563\u2566\u256d\u257da;\u6936uo\u0100;r\u0e19\u1746\u0100du\u2572\u2577har;\u6967shar;\u694bh;\u61b2\u0280;fgqs\u258b\u258c\u0989\u25f3\u25ff\u6264t\u0280ahlrt\u2598\u25a4\u25b7\u25c2\u25e8rrow\u0100;t\u0899\u25a1a\xe9\u24f6arpoon\u0100du\u25af\u25b4own\xbb\u045ap\xbb\u0966eftarrows;\u61c7ight\u0180ahs\u25cd\u25d6\u25derrow\u0100;s\u08f4\u08a7arpoon\xf3\u0f98quigarro\xf7\u21f0hreetimes;\u62cb\u0180;qs\u258b\u0993\u25falan\xf4\u09ac\u0280;cdgs\u09ac\u260a\u260d\u261d\u2628c;\u6aa8ot\u0100;o\u2614\u2615\u6a7f\u0100;r\u261a\u261b\u6a81;\u6a83\u0100;e\u2622\u2625\uc000\u22da\ufe00s;\u6a93\u0280adegs\u2633\u2639\u263d\u2649\u264bppro\xf8\u24c6ot;\u62d6q\u0100gq\u2643\u2645\xf4\u0989gt\xf2\u248c\xf4\u099bi\xed\u09b2\u0180ilr\u2655\u08e1\u265asht;\u697c;\uc000\ud835\udd29\u0100;E\u099c\u2663;\u6a91\u0161\u2669\u2676r\u0100du\u25b2\u266e\u0100;l\u0965\u2673;\u696alk;\u6584cy;\u4459\u0280;acht\u0a48\u2688\u268b\u2691\u2696r\xf2\u25c1orne\xf2\u1d08ard;\u696bri;\u65fa\u0100io\u269f\u26a4dot;\u4140ust\u0100;a\u26ac\u26ad\u63b0che\xbb\u26ad\u0200Eaes\u26bb\u26bd\u26c9\u26d4;\u6268p\u0100;p\u26c3\u26c4\u6a89rox\xbb\u26c4\u0100;q\u26ce\u26cf\u6a87\u0100;q\u26ce\u26bbim;\u62e6\u0400abnoptwz\u26e9\u26f4\u26f7\u271a\u272f\u2741\u2747\u2750\u0100nr\u26ee\u26f1g;\u67ecr;\u61fdr\xeb\u08c1g\u0180lmr\u26ff\u270d\u2714eft\u0100ar\u09e6\u2707ight\xe1\u09f2apsto;\u67fcight\xe1\u09fdparrow\u0100lr\u2725\u2729ef\xf4\u24edight;\u61ac\u0180afl\u2736\u2739\u273dr;\u6985;\uc000\ud835\udd5dus;\u6a2dimes;\u6a34\u0161\u274b\u274fst;\u6217\xe1\u134e\u0180;ef\u2757\u2758\u1800\u65cange\xbb\u2758ar\u0100;l\u2764\u2765\u4028t;\u6993\u0280achmt\u2773\u2776\u277c\u2785\u2787r\xf2\u08a8orne\xf2\u1d8car\u0100;d\u0f98\u2783;\u696d;\u600eri;\u62bf\u0300achiqt\u2798\u279d\u0a40\u27a2\u27ae\u27bbquo;\u6039r;\uc000\ud835\udcc1m\u0180;eg\u09b2\u27aa\u27ac;\u6a8d;\u6a8f\u0100bu\u252a\u27b3o\u0100;r\u0e1f\u27b9;\u601arok;\u4142\u8400<;cdhilqr\u082b\u27d2\u2639\u27dc\u27e0\u27e5\u27ea\u27f0\u0100ci\u27d7\u27d9;\u6aa6r;\u6a79re\xe5\u25f2mes;\u62c9arr;\u6976uest;\u6a7b\u0100Pi\u27f5\u27f9ar;\u6996\u0180;ef\u2800\u092d\u181b\u65c3r\u0100du\u2807\u280dshar;\u694ahar;\u6966\u0100en\u2817\u2821rtneqq;\uc000\u2268\ufe00\xc5\u281e\u0700Dacdefhilnopsu\u2840\u2845\u2882\u288e\u2893\u28a0\u28a5\u28a8\u28da\u28e2\u28e4\u0a83\u28f3\u2902Dot;\u623a\u0200clpr\u284e\u2852\u2863\u287dr\u803b\xaf\u40af\u0100et\u2857\u2859;\u6642\u0100;e\u285e\u285f\u6720se\xbb\u285f\u0100;s\u103b\u2868to\u0200;dlu\u103b\u2873\u2877\u287bow\xee\u048cef\xf4\u090f\xf0\u13d1ker;\u65ae\u0100oy\u2887\u288cmma;\u6a29;\u443cash;\u6014asuredangle\xbb\u1626r;\uc000\ud835\udd2ao;\u6127\u0180cdn\u28af\u28b4\u28c9ro\u803b\xb5\u40b5\u0200;acd\u1464\u28bd\u28c0\u28c4s\xf4\u16a7ir;\u6af0ot\u80bb\xb7\u01b5us\u0180;bd\u28d2\u1903\u28d3\u6212\u0100;u\u1d3c\u28d8;\u6a2a\u0163\u28de\u28e1p;\u6adb\xf2\u2212\xf0\u0a81\u0100dp\u28e9\u28eeels;\u62a7f;\uc000\ud835\udd5e\u0100ct\u28f8\u28fdr;\uc000\ud835\udcc2pos\xbb\u159d\u0180;lm\u2909\u290a\u290d\u43bctimap;\u62b8\u0c00GLRVabcdefghijlmoprstuvw\u2942\u2953\u297e\u2989\u2998\u29da\u29e9\u2a15\u2a1a\u2a58\u2a5d\u2a83\u2a95\u2aa4\u2aa8\u2b04\u2b07\u2b44\u2b7f\u2bae\u2c34\u2c67\u2c7c\u2ce9\u0100gt\u2947\u294b;\uc000\u22d9\u0338\u0100;v\u2950\u0bcf\uc000\u226b\u20d2\u0180elt\u295a\u2972\u2976ft\u0100ar\u2961\u2967rrow;\u61cdightarrow;\u61ce;\uc000\u22d8\u0338\u0100;v\u297b\u0c47\uc000\u226a\u20d2ightarrow;\u61cf\u0100Dd\u298e\u2993ash;\u62afash;\u62ae\u0280bcnpt\u29a3\u29a7\u29ac\u29b1\u29ccla\xbb\u02deute;\u4144g;\uc000\u2220\u20d2\u0280;Eiop\u0d84\u29bc\u29c0\u29c5\u29c8;\uc000\u2a70\u0338d;\uc000\u224b\u0338s;\u4149ro\xf8\u0d84ur\u0100;a\u29d3\u29d4\u666el\u0100;s\u29d3\u0b38\u01f3\u29df\0\u29e3p\u80bb\xa0\u0b37mp\u0100;e\u0bf9\u0c00\u0280aeouy\u29f4\u29fe\u2a03\u2a10\u2a13\u01f0\u29f9\0\u29fb;\u6a43on;\u4148dil;\u4146ng\u0100;d\u0d7e\u2a0aot;\uc000\u2a6d\u0338p;\u6a42;\u443dash;\u6013\u0380;Aadqsx\u0b92\u2a29\u2a2d\u2a3b\u2a41\u2a45\u2a50rr;\u61d7r\u0100hr\u2a33\u2a36k;\u6924\u0100;o\u13f2\u13f0ot;\uc000\u2250\u0338ui\xf6\u0b63\u0100ei\u2a4a\u2a4ear;\u6928\xed\u0b98ist\u0100;s\u0ba0\u0b9fr;\uc000\ud835\udd2b\u0200Eest\u0bc5\u2a66\u2a79\u2a7c\u0180;qs\u0bbc\u2a6d\u0be1\u0180;qs\u0bbc\u0bc5\u2a74lan\xf4\u0be2i\xed\u0bea\u0100;r\u0bb6\u2a81\xbb\u0bb7\u0180Aap\u2a8a\u2a8d\u2a91r\xf2\u2971rr;\u61aear;\u6af2\u0180;sv\u0f8d\u2a9c\u0f8c\u0100;d\u2aa1\u2aa2\u62fc;\u62facy;\u445a\u0380AEadest\u2ab7\u2aba\u2abe\u2ac2\u2ac5\u2af6\u2af9r\xf2\u2966;\uc000\u2266\u0338rr;\u619ar;\u6025\u0200;fqs\u0c3b\u2ace\u2ae3\u2aeft\u0100ar\u2ad4\u2ad9rro\xf7\u2ac1ightarro\xf7\u2a90\u0180;qs\u0c3b\u2aba\u2aealan\xf4\u0c55\u0100;s\u0c55\u2af4\xbb\u0c36i\xed\u0c5d\u0100;r\u0c35\u2afei\u0100;e\u0c1a\u0c25i\xe4\u0d90\u0100pt\u2b0c\u2b11f;\uc000\ud835\udd5f\u8180\xac;in\u2b19\u2b1a\u2b36\u40acn\u0200;Edv\u0b89\u2b24\u2b28\u2b2e;\uc000\u22f9\u0338ot;\uc000\u22f5\u0338\u01e1\u0b89\u2b33\u2b35;\u62f7;\u62f6i\u0100;v\u0cb8\u2b3c\u01e1\u0cb8\u2b41\u2b43;\u62fe;\u62fd\u0180aor\u2b4b\u2b63\u2b69r\u0200;ast\u0b7b\u2b55\u2b5a\u2b5flle\xec\u0b7bl;\uc000\u2afd\u20e5;\uc000\u2202\u0338lint;\u6a14\u0180;ce\u0c92\u2b70\u2b73u\xe5\u0ca5\u0100;c\u0c98\u2b78\u0100;e\u0c92\u2b7d\xf1\u0c98\u0200Aait\u2b88\u2b8b\u2b9d\u2ba7r\xf2\u2988rr\u0180;cw\u2b94\u2b95\u2b99\u619b;\uc000\u2933\u0338;\uc000\u219d\u0338ghtarrow\xbb\u2b95ri\u0100;e\u0ccb\u0cd6\u0380chimpqu\u2bbd\u2bcd\u2bd9\u2b04\u0b78\u2be4\u2bef\u0200;cer\u0d32\u2bc6\u0d37\u2bc9u\xe5\u0d45;\uc000\ud835\udcc3ort\u026d\u2b05\0\0\u2bd6ar\xe1\u2b56m\u0100;e\u0d6e\u2bdf\u0100;q\u0d74\u0d73su\u0100bp\u2beb\u2bed\xe5\u0cf8\xe5\u0d0b\u0180bcp\u2bf6\u2c11\u2c19\u0200;Ees\u2bff\u2c00\u0d22\u2c04\u6284;\uc000\u2ac5\u0338et\u0100;e\u0d1b\u2c0bq\u0100;q\u0d23\u2c00c\u0100;e\u0d32\u2c17\xf1\u0d38\u0200;Ees\u2c22\u2c23\u0d5f\u2c27\u6285;\uc000\u2ac6\u0338et\u0100;e\u0d58\u2c2eq\u0100;q\u0d60\u2c23\u0200gilr\u2c3d\u2c3f\u2c45\u2c47\xec\u0bd7lde\u803b\xf1\u40f1\xe7\u0c43iangle\u0100lr\u2c52\u2c5ceft\u0100;e\u0c1a\u2c5a\xf1\u0c26ight\u0100;e\u0ccb\u2c65\xf1\u0cd7\u0100;m\u2c6c\u2c6d\u43bd\u0180;es\u2c74\u2c75\u2c79\u4023ro;\u6116p;\u6007\u0480DHadgilrs\u2c8f\u2c94\u2c99\u2c9e\u2ca3\u2cb0\u2cb6\u2cd3\u2ce3ash;\u62adarr;\u6904p;\uc000\u224d\u20d2ash;\u62ac\u0100et\u2ca8\u2cac;\uc000\u2265\u20d2;\uc000>\u20d2nfin;\u69de\u0180Aet\u2cbd\u2cc1\u2cc5rr;\u6902;\uc000\u2264\u20d2\u0100;r\u2cca\u2ccd\uc000<\u20d2ie;\uc000\u22b4\u20d2\u0100At\u2cd8\u2cdcrr;\u6903rie;\uc000\u22b5\u20d2im;\uc000\u223c\u20d2\u0180Aan\u2cf0\u2cf4\u2d02rr;\u61d6r\u0100hr\u2cfa\u2cfdk;\u6923\u0100;o\u13e7\u13e5ear;\u6927\u1253\u1a95\0\0\0\0\0\0\0\0\0\0\0\0\0\u2d2d\0\u2d38\u2d48\u2d60\u2d65\u2d72\u2d84\u1b07\0\0\u2d8d\u2dab\0\u2dc8\u2dce\0\u2ddc\u2e19\u2e2b\u2e3e\u2e43\u0100cs\u2d31\u1a97ute\u803b\xf3\u40f3\u0100iy\u2d3c\u2d45r\u0100;c\u1a9e\u2d42\u803b\xf4\u40f4;\u443e\u0280abios\u1aa0\u2d52\u2d57\u01c8\u2d5alac;\u4151v;\u6a38old;\u69bclig;\u4153\u0100cr\u2d69\u2d6dir;\u69bf;\uc000\ud835\udd2c\u036f\u2d79\0\0\u2d7c\0\u2d82n;\u42dbave\u803b\xf2\u40f2;\u69c1\u0100bm\u2d88\u0df4ar;\u69b5\u0200acit\u2d95\u2d98\u2da5\u2da8r\xf2\u1a80\u0100ir\u2d9d\u2da0r;\u69beoss;\u69bbn\xe5\u0e52;\u69c0\u0180aei\u2db1\u2db5\u2db9cr;\u414dga;\u43c9\u0180cdn\u2dc0\u2dc5\u01cdron;\u43bf;\u69b6pf;\uc000\ud835\udd60\u0180ael\u2dd4\u2dd7\u01d2r;\u69b7rp;\u69b9\u0380;adiosv\u2dea\u2deb\u2dee\u2e08\u2e0d\u2e10\u2e16\u6228r\xf2\u1a86\u0200;efm\u2df7\u2df8\u2e02\u2e05\u6a5dr\u0100;o\u2dfe\u2dff\u6134f\xbb\u2dff\u803b\xaa\u40aa\u803b\xba\u40bagof;\u62b6r;\u6a56lope;\u6a57;\u6a5b\u0180clo\u2e1f\u2e21\u2e27\xf2\u2e01ash\u803b\xf8\u40f8l;\u6298i\u016c\u2e2f\u2e34de\u803b\xf5\u40f5es\u0100;a\u01db\u2e3as;\u6a36ml\u803b\xf6\u40f6bar;\u633d\u0ae1\u2e5e\0\u2e7d\0\u2e80\u2e9d\0\u2ea2\u2eb9\0\0\u2ecb\u0e9c\0\u2f13\0\0\u2f2b\u2fbc\0\u2fc8r\u0200;ast\u0403\u2e67\u2e72\u0e85\u8100\xb6;l\u2e6d\u2e6e\u40b6le\xec\u0403\u0269\u2e78\0\0\u2e7bm;\u6af3;\u6afdy;\u443fr\u0280cimpt\u2e8b\u2e8f\u2e93\u1865\u2e97nt;\u4025od;\u402eil;\u6030enk;\u6031r;\uc000\ud835\udd2d\u0180imo\u2ea8\u2eb0\u2eb4\u0100;v\u2ead\u2eae\u43c6;\u43d5ma\xf4\u0a76ne;\u660e\u0180;tv\u2ebf\u2ec0\u2ec8\u43c0chfork\xbb\u1ffd;\u43d6\u0100au\u2ecf\u2edfn\u0100ck\u2ed5\u2eddk\u0100;h\u21f4\u2edb;\u610e\xf6\u21f4s\u0480;abcdemst\u2ef3\u2ef4\u1908\u2ef9\u2efd\u2f04\u2f06\u2f0a\u2f0e\u402bcir;\u6a23ir;\u6a22\u0100ou\u1d40\u2f02;\u6a25;\u6a72n\u80bb\xb1\u0e9dim;\u6a26wo;\u6a27\u0180ipu\u2f19\u2f20\u2f25ntint;\u6a15f;\uc000\ud835\udd61nd\u803b\xa3\u40a3\u0500;Eaceinosu\u0ec8\u2f3f\u2f41\u2f44\u2f47\u2f81\u2f89\u2f92\u2f7e\u2fb6;\u6ab3p;\u6ab7u\xe5\u0ed9\u0100;c\u0ece\u2f4c\u0300;acens\u0ec8\u2f59\u2f5f\u2f66\u2f68\u2f7eppro\xf8\u2f43urlye\xf1\u0ed9\xf1\u0ece\u0180aes\u2f6f\u2f76\u2f7approx;\u6ab9qq;\u6ab5im;\u62e8i\xed\u0edfme\u0100;s\u2f88\u0eae\u6032\u0180Eas\u2f78\u2f90\u2f7a\xf0\u2f75\u0180dfp\u0eec\u2f99\u2faf\u0180als\u2fa0\u2fa5\u2faalar;\u632eine;\u6312urf;\u6313\u0100;t\u0efb\u2fb4\xef\u0efbrel;\u62b0\u0100ci\u2fc0\u2fc5r;\uc000\ud835\udcc5;\u43c8ncsp;\u6008\u0300fiopsu\u2fda\u22e2\u2fdf\u2fe5\u2feb\u2ff1r;\uc000\ud835\udd2epf;\uc000\ud835\udd62rime;\u6057cr;\uc000\ud835\udcc6\u0180aeo\u2ff8\u3009\u3013t\u0100ei\u2ffe\u3005rnion\xf3\u06b0nt;\u6a16st\u0100;e\u3010\u3011\u403f\xf1\u1f19\xf4\u0f14\u0a80ABHabcdefhilmnoprstux\u3040\u3051\u3055\u3059\u30e0\u310e\u312b\u3147\u3162\u3172\u318e\u3206\u3215\u3224\u3229\u3258\u326e\u3272\u3290\u32b0\u32b7\u0180art\u3047\u304a\u304cr\xf2\u10b3\xf2\u03ddail;\u691car\xf2\u1c65ar;\u6964\u0380cdenqrt\u3068\u3075\u3078\u307f\u308f\u3094\u30cc\u0100eu\u306d\u3071;\uc000\u223d\u0331te;\u4155i\xe3\u116emptyv;\u69b3g\u0200;del\u0fd1\u3089\u308b\u308d;\u6992;\u69a5\xe5\u0fd1uo\u803b\xbb\u40bbr\u0580;abcfhlpstw\u0fdc\u30ac\u30af\u30b7\u30b9\u30bc\u30be\u30c0\u30c3\u30c7\u30cap;\u6975\u0100;f\u0fe0\u30b4s;\u6920;\u6933s;\u691e\xeb\u225d\xf0\u272el;\u6945im;\u6974l;\u61a3;\u619d\u0100ai\u30d1\u30d5il;\u691ao\u0100;n\u30db\u30dc\u6236al\xf3\u0f1e\u0180abr\u30e7\u30ea\u30eer\xf2\u17e5rk;\u6773\u0100ak\u30f3\u30fdc\u0100ek\u30f9\u30fb;\u407d;\u405d\u0100es\u3102\u3104;\u698cl\u0100du\u310a\u310c;\u698e;\u6990\u0200aeuy\u3117\u311c\u3127\u3129ron;\u4159\u0100di\u3121\u3125il;\u4157\xec\u0ff2\xe2\u30fa;\u4440\u0200clqs\u3134\u3137\u313d\u3144a;\u6937dhar;\u6969uo\u0100;r\u020e\u020dh;\u61b3\u0180acg\u314e\u315f\u0f44l\u0200;ips\u0f78\u3158\u315b\u109cn\xe5\u10bbar\xf4\u0fa9t;\u65ad\u0180ilr\u3169\u1023\u316esht;\u697d;\uc000\ud835\udd2f\u0100ao\u3177\u3186r\u0100du\u317d\u317f\xbb\u047b\u0100;l\u1091\u3184;\u696c\u0100;v\u318b\u318c\u43c1;\u43f1\u0180gns\u3195\u31f9\u31fcht\u0300ahlrst\u31a4\u31b0\u31c2\u31d8\u31e4\u31eerrow\u0100;t\u0fdc\u31ada\xe9\u30c8arpoon\u0100du\u31bb\u31bfow\xee\u317ep\xbb\u1092eft\u0100ah\u31ca\u31d0rrow\xf3\u0feaarpoon\xf3\u0551ightarrows;\u61c9quigarro\xf7\u30cbhreetimes;\u62ccg;\u42daingdotse\xf1\u1f32\u0180ahm\u320d\u3210\u3213r\xf2\u0feaa\xf2\u0551;\u600foust\u0100;a\u321e\u321f\u63b1che\xbb\u321fmid;\u6aee\u0200abpt\u3232\u323d\u3240\u3252\u0100nr\u3237\u323ag;\u67edr;\u61fer\xeb\u1003\u0180afl\u3247\u324a\u324er;\u6986;\uc000\ud835\udd63us;\u6a2eimes;\u6a35\u0100ap\u325d\u3267r\u0100;g\u3263\u3264\u4029t;\u6994olint;\u6a12ar\xf2\u31e3\u0200achq\u327b\u3280\u10bc\u3285quo;\u603ar;\uc000\ud835\udcc7\u0100bu\u30fb\u328ao\u0100;r\u0214\u0213\u0180hir\u3297\u329b\u32a0re\xe5\u31f8mes;\u62cai\u0200;efl\u32aa\u1059\u1821\u32ab\u65b9tri;\u69celuhar;\u6968;\u611e\u0d61\u32d5\u32db\u32df\u332c\u3338\u3371\0\u337a\u33a4\0\0\u33ec\u33f0\0\u3428\u3448\u345a\u34ad\u34b1\u34ca\u34f1\0\u3616\0\0\u3633cute;\u415bqu\xef\u27ba\u0500;Eaceinpsy\u11ed\u32f3\u32f5\u32ff\u3302\u330b\u330f\u331f\u3326\u3329;\u6ab4\u01f0\u32fa\0\u32fc;\u6ab8on;\u4161u\xe5\u11fe\u0100;d\u11f3\u3307il;\u415frc;\u415d\u0180Eas\u3316\u3318\u331b;\u6ab6p;\u6abaim;\u62e9olint;\u6a13i\xed\u1204;\u4441ot\u0180;be\u3334\u1d47\u3335\u62c5;\u6a66\u0380Aacmstx\u3346\u334a\u3357\u335b\u335e\u3363\u336drr;\u61d8r\u0100hr\u3350\u3352\xeb\u2228\u0100;o\u0a36\u0a34t\u803b\xa7\u40a7i;\u403bwar;\u6929m\u0100in\u3369\xf0nu\xf3\xf1t;\u6736r\u0100;o\u3376\u2055\uc000\ud835\udd30\u0200acoy\u3382\u3386\u3391\u33a0rp;\u666f\u0100hy\u338b\u338fcy;\u4449;\u4448rt\u026d\u3399\0\0\u339ci\xe4\u1464ara\xec\u2e6f\u803b\xad\u40ad\u0100gm\u33a8\u33b4ma\u0180;fv\u33b1\u33b2\u33b2\u43c3;\u43c2\u0400;deglnpr\u12ab\u33c5\u33c9\u33ce\u33d6\u33de\u33e1\u33e6ot;\u6a6a\u0100;q\u12b1\u12b0\u0100;E\u33d3\u33d4\u6a9e;\u6aa0\u0100;E\u33db\u33dc\u6a9d;\u6a9fe;\u6246lus;\u6a24arr;\u6972ar\xf2\u113d\u0200aeit\u33f8\u3408\u340f\u3417\u0100ls\u33fd\u3404lsetm\xe9\u336ahp;\u6a33parsl;\u69e4\u0100dl\u1463\u3414e;\u6323\u0100;e\u341c\u341d\u6aaa\u0100;s\u3422\u3423\u6aac;\uc000\u2aac\ufe00\u0180flp\u342e\u3433\u3442tcy;\u444c\u0100;b\u3438\u3439\u402f\u0100;a\u343e\u343f\u69c4r;\u633ff;\uc000\ud835\udd64a\u0100dr\u344d\u0402es\u0100;u\u3454\u3455\u6660it\xbb\u3455\u0180csu\u3460\u3479\u349f\u0100au\u3465\u346fp\u0100;s\u1188\u346b;\uc000\u2293\ufe00p\u0100;s\u11b4\u3475;\uc000\u2294\ufe00u\u0100bp\u347f\u348f\u0180;es\u1197\u119c\u3486et\u0100;e\u1197\u348d\xf1\u119d\u0180;es\u11a8\u11ad\u3496et\u0100;e\u11a8\u349d\xf1\u11ae\u0180;af\u117b\u34a6\u05b0r\u0165\u34ab\u05b1\xbb\u117car\xf2\u1148\u0200cemt\u34b9\u34be\u34c2\u34c5r;\uc000\ud835\udcc8tm\xee\xf1i\xec\u3415ar\xe6\u11be\u0100ar\u34ce\u34d5r\u0100;f\u34d4\u17bf\u6606\u0100an\u34da\u34edight\u0100ep\u34e3\u34eapsilo\xee\u1ee0h\xe9\u2eafs\xbb\u2852\u0280bcmnp\u34fb\u355e\u1209\u358b\u358e\u0480;Edemnprs\u350e\u350f\u3511\u3515\u351e\u3523\u352c\u3531\u3536\u6282;\u6ac5ot;\u6abd\u0100;d\u11da\u351aot;\u6ac3ult;\u6ac1\u0100Ee\u3528\u352a;\u6acb;\u628alus;\u6abfarr;\u6979\u0180eiu\u353d\u3552\u3555t\u0180;en\u350e\u3545\u354bq\u0100;q\u11da\u350feq\u0100;q\u352b\u3528m;\u6ac7\u0100bp\u355a\u355c;\u6ad5;\u6ad3c\u0300;acens\u11ed\u356c\u3572\u3579\u357b\u3326ppro\xf8\u32faurlye\xf1\u11fe\xf1\u11f3\u0180aes\u3582\u3588\u331bppro\xf8\u331aq\xf1\u3317g;\u666a\u0680123;Edehlmnps\u35a9\u35ac\u35af\u121c\u35b2\u35b4\u35c0\u35c9\u35d5\u35da\u35df\u35e8\u35ed\u803b\xb9\u40b9\u803b\xb2\u40b2\u803b\xb3\u40b3;\u6ac6\u0100os\u35b9\u35bct;\u6abeub;\u6ad8\u0100;d\u1222\u35c5ot;\u6ac4s\u0100ou\u35cf\u35d2l;\u67c9b;\u6ad7arr;\u697bult;\u6ac2\u0100Ee\u35e4\u35e6;\u6acc;\u628blus;\u6ac0\u0180eiu\u35f4\u3609\u360ct\u0180;en\u121c\u35fc\u3602q\u0100;q\u1222\u35b2eq\u0100;q\u35e7\u35e4m;\u6ac8\u0100bp\u3611\u3613;\u6ad4;\u6ad6\u0180Aan\u361c\u3620\u362drr;\u61d9r\u0100hr\u3626\u3628\xeb\u222e\u0100;o\u0a2b\u0a29war;\u692alig\u803b\xdf\u40df\u0be1\u3651\u365d\u3660\u12ce\u3673\u3679\0\u367e\u36c2\0\0\0\0\0\u36db\u3703\0\u3709\u376c\0\0\0\u3787\u0272\u3656\0\0\u365bget;\u6316;\u43c4r\xeb\u0e5f\u0180aey\u3666\u366b\u3670ron;\u4165dil;\u4163;\u4442lrec;\u6315r;\uc000\ud835\udd31\u0200eiko\u3686\u369d\u36b5\u36bc\u01f2\u368b\0\u3691e\u01004f\u1284\u1281a\u0180;sv\u3698\u3699\u369b\u43b8ym;\u43d1\u0100cn\u36a2\u36b2k\u0100as\u36a8\u36aeppro\xf8\u12c1im\xbb\u12acs\xf0\u129e\u0100as\u36ba\u36ae\xf0\u12c1rn\u803b\xfe\u40fe\u01ec\u031f\u36c6\u22e7es\u8180\xd7;bd\u36cf\u36d0\u36d8\u40d7\u0100;a\u190f\u36d5r;\u6a31;\u6a30\u0180eps\u36e1\u36e3\u3700\xe1\u2a4d\u0200;bcf\u0486\u36ec\u36f0\u36f4ot;\u6336ir;\u6af1\u0100;o\u36f9\u36fc\uc000\ud835\udd65rk;\u6ada\xe1\u3362rime;\u6034\u0180aip\u370f\u3712\u3764d\xe5\u1248\u0380adempst\u3721\u374d\u3740\u3751\u3757\u375c\u375fngle\u0280;dlqr\u3730\u3731\u3736\u3740\u3742\u65b5own\xbb\u1dbbeft\u0100;e\u2800\u373e\xf1\u092e;\u625cight\u0100;e\u32aa\u374b\xf1\u105aot;\u65ecinus;\u6a3alus;\u6a39b;\u69cdime;\u6a3bezium;\u63e2\u0180cht\u3772\u377d\u3781\u0100ry\u3777\u377b;\uc000\ud835\udcc9;\u4446cy;\u445brok;\u4167\u0100io\u378b\u378ex\xf4\u1777head\u0100lr\u3797\u37a0eftarro\xf7\u084fightarrow\xbb\u0f5d\u0900AHabcdfghlmoprstuw\u37d0\u37d3\u37d7\u37e4\u37f0\u37fc\u380e\u381c\u3823\u3834\u3851\u385d\u386b\u38a9\u38cc\u38d2\u38ea\u38f6r\xf2\u03edar;\u6963\u0100cr\u37dc\u37e2ute\u803b\xfa\u40fa\xf2\u1150r\u01e3\u37ea\0\u37edy;\u445eve;\u416d\u0100iy\u37f5\u37farc\u803b\xfb\u40fb;\u4443\u0180abh\u3803\u3806\u380br\xf2\u13adlac;\u4171a\xf2\u13c3\u0100ir\u3813\u3818sht;\u697e;\uc000\ud835\udd32rave\u803b\xf9\u40f9\u0161\u3827\u3831r\u0100lr\u382c\u382e\xbb\u0957\xbb\u1083lk;\u6580\u0100ct\u3839\u384d\u026f\u383f\0\0\u384arn\u0100;e\u3845\u3846\u631cr\xbb\u3846op;\u630fri;\u65f8\u0100al\u3856\u385acr;\u416b\u80bb\xa8\u0349\u0100gp\u3862\u3866on;\u4173f;\uc000\ud835\udd66\u0300adhlsu\u114b\u3878\u387d\u1372\u3891\u38a0own\xe1\u13b3arpoon\u0100lr\u3888\u388cef\xf4\u382digh\xf4\u382fi\u0180;hl\u3899\u389a\u389c\u43c5\xbb\u13faon\xbb\u389aparrows;\u61c8\u0180cit\u38b0\u38c4\u38c8\u026f\u38b6\0\0\u38c1rn\u0100;e\u38bc\u38bd\u631dr\xbb\u38bdop;\u630eng;\u416fri;\u65f9cr;\uc000\ud835\udcca\u0180dir\u38d9\u38dd\u38e2ot;\u62f0lde;\u4169i\u0100;f\u3730\u38e8\xbb\u1813\u0100am\u38ef\u38f2r\xf2\u38a8l\u803b\xfc\u40fcangle;\u69a7\u0780ABDacdeflnoprsz\u391c\u391f\u3929\u392d\u39b5\u39b8\u39bd\u39df\u39e4\u39e8\u39f3\u39f9\u39fd\u3a01\u3a20r\xf2\u03f7ar\u0100;v\u3926\u3927\u6ae8;\u6ae9as\xe8\u03e1\u0100nr\u3932\u3937grt;\u699c\u0380eknprst\u34e3\u3946\u394b\u3952\u395d\u3964\u3996app\xe1\u2415othin\xe7\u1e96\u0180hir\u34eb\u2ec8\u3959op\xf4\u2fb5\u0100;h\u13b7\u3962\xef\u318d\u0100iu\u3969\u396dgm\xe1\u33b3\u0100bp\u3972\u3984setneq\u0100;q\u397d\u3980\uc000\u228a\ufe00;\uc000\u2acb\ufe00setneq\u0100;q\u398f\u3992\uc000\u228b\ufe00;\uc000\u2acc\ufe00\u0100hr\u399b\u399fet\xe1\u369ciangle\u0100lr\u39aa\u39afeft\xbb\u0925ight\xbb\u1051y;\u4432ash\xbb\u1036\u0180elr\u39c4\u39d2\u39d7\u0180;be\u2dea\u39cb\u39cfar;\u62bbq;\u625alip;\u62ee\u0100bt\u39dc\u1468a\xf2\u1469r;\uc000\ud835\udd33tr\xe9\u39aesu\u0100bp\u39ef\u39f1\xbb\u0d1c\xbb\u0d59pf;\uc000\ud835\udd67ro\xf0\u0efbtr\xe9\u39b4\u0100cu\u3a06\u3a0br;\uc000\ud835\udccb\u0100bp\u3a10\u3a18n\u0100Ee\u3980\u3a16\xbb\u397en\u0100Ee\u3992\u3a1e\xbb\u3990igzag;\u699a\u0380cefoprs\u3a36\u3a3b\u3a56\u3a5b\u3a54\u3a61\u3a6airc;\u4175\u0100di\u3a40\u3a51\u0100bg\u3a45\u3a49ar;\u6a5fe\u0100;q\u15fa\u3a4f;\u6259erp;\u6118r;\uc000\ud835\udd34pf;\uc000\ud835\udd68\u0100;e\u1479\u3a66at\xe8\u1479cr;\uc000\ud835\udccc\u0ae3\u178e\u3a87\0\u3a8b\0\u3a90\u3a9b\0\0\u3a9d\u3aa8\u3aab\u3aaf\0\0\u3ac3\u3ace\0\u3ad8\u17dc\u17dftr\xe9\u17d1r;\uc000\ud835\udd35\u0100Aa\u3a94\u3a97r\xf2\u03c3r\xf2\u09f6;\u43be\u0100Aa\u3aa1\u3aa4r\xf2\u03b8r\xf2\u09eba\xf0\u2713is;\u62fb\u0180dpt\u17a4\u3ab5\u3abe\u0100fl\u3aba\u17a9;\uc000\ud835\udd69im\xe5\u17b2\u0100Aa\u3ac7\u3acar\xf2\u03cer\xf2\u0a01\u0100cq\u3ad2\u17b8r;\uc000\ud835\udccd\u0100pt\u17d6\u3adcr\xe9\u17d4\u0400acefiosu\u3af0\u3afd\u3b08\u3b0c\u3b11\u3b15\u3b1b\u3b21c\u0100uy\u3af6\u3afbte\u803b\xfd\u40fd;\u444f\u0100iy\u3b02\u3b06rc;\u4177;\u444bn\u803b\xa5\u40a5r;\uc000\ud835\udd36cy;\u4457pf;\uc000\ud835\udd6acr;\uc000\ud835\udcce\u0100cm\u3b26\u3b29y;\u444el\u803b\xff\u40ff\u0500acdefhiosw\u3b42\u3b48\u3b54\u3b58\u3b64\u3b69\u3b6d\u3b74\u3b7a\u3b80cute;\u417a\u0100ay\u3b4d\u3b52ron;\u417e;\u4437ot;\u417c\u0100et\u3b5d\u3b61tr\xe6\u155fa;\u43b6r;\uc000\ud835\udd37cy;\u4436grarr;\u61ddpf;\uc000\ud835\udd6bcr;\uc000\ud835\udccf\u0100jn\u3b85\u3b87;\u600dj;\u600c"
        .split("")
        .map(function (c) { return c.charCodeAt(0); }));


    var decodeDataHtml = /*#__PURE__*/Object.defineProperty({
    	default: _default$2
    }, '__esModule', {value: true});

    // Generated using scripts/write-decode-map.ts

    var _default$1 = new Uint16Array(
    // prettier-ignore
    "\u0200aglq\t\x15\x18\x1b\u026d\x0f\0\0\x12p;\u4026os;\u4027t;\u403et;\u403cuot;\u4022"
        .split("")
        .map(function (c) { return c.charCodeAt(0); }));


    var decodeDataXml = /*#__PURE__*/Object.defineProperty({
    	default: _default$1
    }, '__esModule', {value: true});

    var decode_codepoint = createCommonjsModule(function (module, exports) {
    // Adapted from https://github.com/mathiasbynens/he/blob/36afe179392226cf1b6ccdb16ebbb7a5a844d93a/src/he.js#L106-L134
    var _a;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.replaceCodePoint = exports.fromCodePoint = void 0;
    var decodeMap = new Map([
        [0, 65533],
        [128, 8364],
        [130, 8218],
        [131, 402],
        [132, 8222],
        [133, 8230],
        [134, 8224],
        [135, 8225],
        [136, 710],
        [137, 8240],
        [138, 352],
        [139, 8249],
        [140, 338],
        [142, 381],
        [145, 8216],
        [146, 8217],
        [147, 8220],
        [148, 8221],
        [149, 8226],
        [150, 8211],
        [151, 8212],
        [152, 732],
        [153, 8482],
        [154, 353],
        [155, 8250],
        [156, 339],
        [158, 382],
        [159, 376],
    ]);
    exports.fromCodePoint = 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, node/no-unsupported-features/es-builtins
    (_a = String.fromCodePoint) !== null && _a !== void 0 ? _a : function (codePoint) {
        var output = "";
        if (codePoint > 0xffff) {
            codePoint -= 0x10000;
            output += String.fromCharCode(((codePoint >>> 10) & 0x3ff) | 0xd800);
            codePoint = 0xdc00 | (codePoint & 0x3ff);
        }
        output += String.fromCharCode(codePoint);
        return output;
    };
    function replaceCodePoint(codePoint) {
        var _a;
        if ((codePoint >= 0xd800 && codePoint <= 0xdfff) || codePoint > 0x10ffff) {
            return 0xfffd;
        }
        return (_a = decodeMap.get(codePoint)) !== null && _a !== void 0 ? _a : codePoint;
    }
    exports.replaceCodePoint = replaceCodePoint;
    function decodeCodePoint(codePoint) {
        return (0, exports.fromCodePoint)(replaceCodePoint(codePoint));
    }
    exports.default = decodeCodePoint;

    });

    var require$$0$4 = decodeDataHtml;

    var require$$1$1 = decodeDataXml;

    var decode_codepoint_js_2 = decode_codepoint;

    var decode = createCommonjsModule(function (module, exports) {
    var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.decodeXML = exports.decodeHTMLStrict = exports.decodeHTML = exports.determineBranch = exports.BinTrieFlags = exports.fromCodePoint = exports.replaceCodePoint = exports.decodeCodePoint = exports.xmlDecodeTree = exports.htmlDecodeTree = void 0;
    var decode_data_html_js_1 = __importDefault(require$$0$4);
    exports.htmlDecodeTree = decode_data_html_js_1.default;
    var decode_data_xml_js_1 = __importDefault(require$$1$1);
    exports.xmlDecodeTree = decode_data_xml_js_1.default;
    var decode_codepoint_js_1 = __importDefault(decode_codepoint_js_2);
    exports.decodeCodePoint = decode_codepoint_js_1.default;

    Object.defineProperty(exports, "replaceCodePoint", { enumerable: true, get: function () { return decode_codepoint_js_2.replaceCodePoint; } });
    Object.defineProperty(exports, "fromCodePoint", { enumerable: true, get: function () { return decode_codepoint_js_2.fromCodePoint; } });
    var CharCodes;
    (function (CharCodes) {
        CharCodes[CharCodes["NUM"] = 35] = "NUM";
        CharCodes[CharCodes["SEMI"] = 59] = "SEMI";
        CharCodes[CharCodes["ZERO"] = 48] = "ZERO";
        CharCodes[CharCodes["NINE"] = 57] = "NINE";
        CharCodes[CharCodes["LOWER_A"] = 97] = "LOWER_A";
        CharCodes[CharCodes["LOWER_F"] = 102] = "LOWER_F";
        CharCodes[CharCodes["LOWER_X"] = 120] = "LOWER_X";
        /** Bit that needs to be set to convert an upper case ASCII character to lower case */
        CharCodes[CharCodes["To_LOWER_BIT"] = 32] = "To_LOWER_BIT";
    })(CharCodes || (CharCodes = {}));
    var BinTrieFlags;
    (function (BinTrieFlags) {
        BinTrieFlags[BinTrieFlags["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
        BinTrieFlags[BinTrieFlags["BRANCH_LENGTH"] = 16256] = "BRANCH_LENGTH";
        BinTrieFlags[BinTrieFlags["JUMP_TABLE"] = 127] = "JUMP_TABLE";
    })(BinTrieFlags = exports.BinTrieFlags || (exports.BinTrieFlags = {}));
    function getDecoder(decodeTree) {
        return function decodeHTMLBinary(str, strict) {
            var ret = "";
            var lastIdx = 0;
            var strIdx = 0;
            while ((strIdx = str.indexOf("&", strIdx)) >= 0) {
                ret += str.slice(lastIdx, strIdx);
                lastIdx = strIdx;
                // Skip the "&"
                strIdx += 1;
                // If we have a numeric entity, handle this separately.
                if (str.charCodeAt(strIdx) === CharCodes.NUM) {
                    // Skip the leading "&#". For hex entities, also skip the leading "x".
                    var start = strIdx + 1;
                    var base = 10;
                    var cp = str.charCodeAt(start);
                    if ((cp | CharCodes.To_LOWER_BIT) === CharCodes.LOWER_X) {
                        base = 16;
                        strIdx += 1;
                        start += 1;
                    }
                    do
                        cp = str.charCodeAt(++strIdx);
                    while ((cp >= CharCodes.ZERO && cp <= CharCodes.NINE) ||
                        (base === 16 &&
                            (cp | CharCodes.To_LOWER_BIT) >= CharCodes.LOWER_A &&
                            (cp | CharCodes.To_LOWER_BIT) <= CharCodes.LOWER_F));
                    if (start !== strIdx) {
                        var entity = str.substring(start, strIdx);
                        var parsed = parseInt(entity, base);
                        if (str.charCodeAt(strIdx) === CharCodes.SEMI) {
                            strIdx += 1;
                        }
                        else if (strict) {
                            continue;
                        }
                        ret += (0, decode_codepoint_js_1.default)(parsed);
                        lastIdx = strIdx;
                    }
                    continue;
                }
                var resultIdx = 0;
                var excess = 1;
                var treeIdx = 0;
                var current = decodeTree[treeIdx];
                for (; strIdx < str.length; strIdx++, excess++) {
                    treeIdx = determineBranch(decodeTree, current, treeIdx + 1, str.charCodeAt(strIdx));
                    if (treeIdx < 0)
                        break;
                    current = decodeTree[treeIdx];
                    var masked = current & BinTrieFlags.VALUE_LENGTH;
                    // If the branch is a value, store it and continue
                    if (masked) {
                        // If we have a legacy entity while parsing strictly, just skip the number of bytes
                        if (!strict || str.charCodeAt(strIdx) === CharCodes.SEMI) {
                            resultIdx = treeIdx;
                            excess = 0;
                        }
                        // The mask is the number of bytes of the value, including the current byte.
                        var valueLength = (masked >> 14) - 1;
                        if (valueLength === 0)
                            break;
                        treeIdx += valueLength;
                    }
                }
                if (resultIdx !== 0) {
                    var valueLength = (decodeTree[resultIdx] & BinTrieFlags.VALUE_LENGTH) >> 14;
                    ret +=
                        valueLength === 1
                            ? String.fromCharCode(decodeTree[resultIdx] & ~BinTrieFlags.VALUE_LENGTH)
                            : valueLength === 2
                                ? String.fromCharCode(decodeTree[resultIdx + 1])
                                : String.fromCharCode(decodeTree[resultIdx + 1], decodeTree[resultIdx + 2]);
                    lastIdx = strIdx - excess + 1;
                }
            }
            return ret + str.slice(lastIdx);
        };
    }
    function determineBranch(decodeTree, current, nodeIdx, char) {
        var branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        var jumpOffset = current & BinTrieFlags.JUMP_TABLE;
        // Case 1: Single branch encoded in jump offset
        if (branchCount === 0) {
            return jumpOffset !== 0 && char === jumpOffset ? nodeIdx : -1;
        }
        // Case 2: Multiple branches encoded in jump table
        if (jumpOffset) {
            var value = char - jumpOffset;
            return value < 0 || value >= branchCount
                ? -1
                : decodeTree[nodeIdx + value] - 1;
        }
        // Case 3: Multiple branches encoded in dictionary
        // Binary search for the character.
        var lo = nodeIdx;
        var hi = lo + branchCount - 1;
        while (lo <= hi) {
            var mid = (lo + hi) >>> 1;
            var midVal = decodeTree[mid];
            if (midVal < char) {
                lo = mid + 1;
            }
            else if (midVal > char) {
                hi = mid - 1;
            }
            else {
                return decodeTree[mid + branchCount];
            }
        }
        return -1;
    }
    exports.determineBranch = determineBranch;
    var htmlDecoder = getDecoder(decode_data_html_js_1.default);
    var xmlDecoder = getDecoder(decode_data_xml_js_1.default);
    /**
     * Decodes an HTML string, allowing for entities not terminated by a semi-colon.
     *
     * @param str The string to decode.
     * @returns The decoded string.
     */
    function decodeHTML(str) {
        return htmlDecoder(str, false);
    }
    exports.decodeHTML = decodeHTML;
    /**
     * Decodes an HTML string, requiring all entities to be terminated by a semi-colon.
     *
     * @param str The string to decode.
     * @returns The decoded string.
     */
    function decodeHTMLStrict(str) {
        return htmlDecoder(str, true);
    }
    exports.decodeHTMLStrict = decodeHTMLStrict;
    /**
     * Decodes an XML string, requiring all entities to be terminated by a semi-colon.
     *
     * @param str The string to decode.
     * @returns The decoded string.
     */
    function decodeXML(str) {
        return xmlDecoder(str, true);
    }
    exports.decodeXML = decodeXML;

    });

    var decode_js_1 = decode;

    var Tokenizer_1 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.QuoteType = void 0;

    var CharCodes;
    (function (CharCodes) {
        CharCodes[CharCodes["Tab"] = 9] = "Tab";
        CharCodes[CharCodes["NewLine"] = 10] = "NewLine";
        CharCodes[CharCodes["FormFeed"] = 12] = "FormFeed";
        CharCodes[CharCodes["CarriageReturn"] = 13] = "CarriageReturn";
        CharCodes[CharCodes["Space"] = 32] = "Space";
        CharCodes[CharCodes["ExclamationMark"] = 33] = "ExclamationMark";
        CharCodes[CharCodes["Num"] = 35] = "Num";
        CharCodes[CharCodes["Amp"] = 38] = "Amp";
        CharCodes[CharCodes["SingleQuote"] = 39] = "SingleQuote";
        CharCodes[CharCodes["DoubleQuote"] = 34] = "DoubleQuote";
        CharCodes[CharCodes["Dash"] = 45] = "Dash";
        CharCodes[CharCodes["Slash"] = 47] = "Slash";
        CharCodes[CharCodes["Zero"] = 48] = "Zero";
        CharCodes[CharCodes["Nine"] = 57] = "Nine";
        CharCodes[CharCodes["Semi"] = 59] = "Semi";
        CharCodes[CharCodes["Lt"] = 60] = "Lt";
        CharCodes[CharCodes["Eq"] = 61] = "Eq";
        CharCodes[CharCodes["Gt"] = 62] = "Gt";
        CharCodes[CharCodes["Questionmark"] = 63] = "Questionmark";
        CharCodes[CharCodes["UpperA"] = 65] = "UpperA";
        CharCodes[CharCodes["LowerA"] = 97] = "LowerA";
        CharCodes[CharCodes["UpperF"] = 70] = "UpperF";
        CharCodes[CharCodes["LowerF"] = 102] = "LowerF";
        CharCodes[CharCodes["UpperZ"] = 90] = "UpperZ";
        CharCodes[CharCodes["LowerZ"] = 122] = "LowerZ";
        CharCodes[CharCodes["LowerX"] = 120] = "LowerX";
        CharCodes[CharCodes["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
    })(CharCodes || (CharCodes = {}));
    /** All the states the tokenizer can be in. */
    var State;
    (function (State) {
        State[State["Text"] = 1] = "Text";
        State[State["BeforeTagName"] = 2] = "BeforeTagName";
        State[State["InTagName"] = 3] = "InTagName";
        State[State["InSelfClosingTag"] = 4] = "InSelfClosingTag";
        State[State["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
        State[State["InClosingTagName"] = 6] = "InClosingTagName";
        State[State["AfterClosingTagName"] = 7] = "AfterClosingTagName";
        // Attributes
        State[State["BeforeAttributeName"] = 8] = "BeforeAttributeName";
        State[State["InAttributeName"] = 9] = "InAttributeName";
        State[State["AfterAttributeName"] = 10] = "AfterAttributeName";
        State[State["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
        State[State["InAttributeValueDq"] = 12] = "InAttributeValueDq";
        State[State["InAttributeValueSq"] = 13] = "InAttributeValueSq";
        State[State["InAttributeValueNq"] = 14] = "InAttributeValueNq";
        // Declarations
        State[State["BeforeDeclaration"] = 15] = "BeforeDeclaration";
        State[State["InDeclaration"] = 16] = "InDeclaration";
        // Processing instructions
        State[State["InProcessingInstruction"] = 17] = "InProcessingInstruction";
        // Comments & CDATA
        State[State["BeforeComment"] = 18] = "BeforeComment";
        State[State["CDATASequence"] = 19] = "CDATASequence";
        State[State["InSpecialComment"] = 20] = "InSpecialComment";
        State[State["InCommentLike"] = 21] = "InCommentLike";
        // Special tags
        State[State["BeforeSpecialS"] = 22] = "BeforeSpecialS";
        State[State["SpecialStartSequence"] = 23] = "SpecialStartSequence";
        State[State["InSpecialTag"] = 24] = "InSpecialTag";
        State[State["BeforeEntity"] = 25] = "BeforeEntity";
        State[State["BeforeNumericEntity"] = 26] = "BeforeNumericEntity";
        State[State["InNamedEntity"] = 27] = "InNamedEntity";
        State[State["InNumericEntity"] = 28] = "InNumericEntity";
        State[State["InHexEntity"] = 29] = "InHexEntity";
    })(State || (State = {}));
    function isWhitespace(c) {
        return (c === CharCodes.Space ||
            c === CharCodes.NewLine ||
            c === CharCodes.Tab ||
            c === CharCodes.FormFeed ||
            c === CharCodes.CarriageReturn);
    }
    function isEndOfTagSection(c) {
        return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
    }
    function isNumber(c) {
        return c >= CharCodes.Zero && c <= CharCodes.Nine;
    }
    function isASCIIAlpha(c) {
        return ((c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
            (c >= CharCodes.UpperA && c <= CharCodes.UpperZ));
    }
    function isHexDigit(c) {
        return ((c >= CharCodes.UpperA && c <= CharCodes.UpperF) ||
            (c >= CharCodes.LowerA && c <= CharCodes.LowerF));
    }
    var QuoteType;
    (function (QuoteType) {
        QuoteType[QuoteType["NoValue"] = 0] = "NoValue";
        QuoteType[QuoteType["Unquoted"] = 1] = "Unquoted";
        QuoteType[QuoteType["Single"] = 2] = "Single";
        QuoteType[QuoteType["Double"] = 3] = "Double";
    })(QuoteType = exports.QuoteType || (exports.QuoteType = {}));
    /**
     * Sequences used to match longer strings.
     *
     * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
     * sequences with an increased offset.
     */
    var Sequences = {
        Cdata: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]),
        CdataEnd: new Uint8Array([0x5d, 0x5d, 0x3e]),
        CommentEnd: new Uint8Array([0x2d, 0x2d, 0x3e]),
        ScriptEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]),
        StyleEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x74, 0x79, 0x6c, 0x65]),
        TitleEnd: new Uint8Array([0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65]), // `</title`
    };
    var Tokenizer = /** @class */ (function () {
        function Tokenizer(_a, cbs) {
            var _b = _a.xmlMode, xmlMode = _b === void 0 ? false : _b, _c = _a.decodeEntities, decodeEntities = _c === void 0 ? true : _c;
            this.cbs = cbs;
            /** The current state the tokenizer is in. */
            this.state = State.Text;
            /** The read buffer. */
            this.buffer = "";
            /** The beginning of the section that is currently being read. */
            this.sectionStart = 0;
            /** The index within the buffer that we are currently looking at. */
            this.index = 0;
            /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
            this.baseState = State.Text;
            /** For special parsing behavior inside of script and style tags. */
            this.isSpecial = false;
            /** Indicates whether the tokenizer has been paused. */
            this.running = true;
            /** The offset of the current buffer. */
            this.offset = 0;
            this.sequenceIndex = 0;
            this.trieIndex = 0;
            this.trieCurrent = 0;
            /** For named entities, the index of the value. For numeric entities, the code point. */
            this.entityResult = 0;
            this.entityExcess = 0;
            this.xmlMode = xmlMode;
            this.decodeEntities = decodeEntities;
            this.entityTrie = xmlMode ? decode_js_1.xmlDecodeTree : decode_js_1.htmlDecodeTree;
        }
        Tokenizer.prototype.reset = function () {
            this.state = State.Text;
            this.buffer = "";
            this.sectionStart = 0;
            this.index = 0;
            this.baseState = State.Text;
            this.currentSequence = undefined;
            this.running = true;
            this.offset = 0;
        };
        Tokenizer.prototype.write = function (chunk) {
            this.offset += this.buffer.length;
            this.buffer = chunk;
            this.parse();
        };
        Tokenizer.prototype.end = function () {
            if (this.running)
                this.finish();
        };
        Tokenizer.prototype.pause = function () {
            this.running = false;
        };
        Tokenizer.prototype.resume = function () {
            this.running = true;
            if (this.index < this.buffer.length + this.offset) {
                this.parse();
            }
        };
        /**
         * The current index within all of the written data.
         */
        Tokenizer.prototype.getIndex = function () {
            return this.index;
        };
        /**
         * The start of the current section.
         */
        Tokenizer.prototype.getSectionStart = function () {
            return this.sectionStart;
        };
        Tokenizer.prototype.stateText = function (c) {
            if (c === CharCodes.Lt ||
                (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))) {
                if (this.index > this.sectionStart) {
                    this.cbs.ontext(this.sectionStart, this.index);
                }
                this.state = State.BeforeTagName;
                this.sectionStart = this.index;
            }
            else if (this.decodeEntities && c === CharCodes.Amp) {
                this.state = State.BeforeEntity;
            }
        };
        Tokenizer.prototype.stateSpecialStartSequence = function (c) {
            var isEnd = this.sequenceIndex === this.currentSequence.length;
            var isMatch = isEnd
                ? // If we are at the end of the sequence, make sure the tag name has ended
                    isEndOfTagSection(c)
                : // Otherwise, do a case-insensitive comparison
                    (c | 0x20) === this.currentSequence[this.sequenceIndex];
            if (!isMatch) {
                this.isSpecial = false;
            }
            else if (!isEnd) {
                this.sequenceIndex++;
                return;
            }
            this.sequenceIndex = 0;
            this.state = State.InTagName;
            this.stateInTagName(c);
        };
        /** Look for an end tag. For <title> tags, also decode entities. */
        Tokenizer.prototype.stateInSpecialTag = function (c) {
            if (this.sequenceIndex === this.currentSequence.length) {
                if (c === CharCodes.Gt || isWhitespace(c)) {
                    var endOfText = this.index - this.currentSequence.length;
                    if (this.sectionStart < endOfText) {
                        // Spoof the index so that reported locations match up.
                        var actualIndex = this.index;
                        this.index = endOfText;
                        this.cbs.ontext(this.sectionStart, endOfText);
                        this.index = actualIndex;
                    }
                    this.isSpecial = false;
                    this.sectionStart = endOfText + 2; // Skip over the `</`
                    this.stateInClosingTagName(c);
                    return; // We are done; skip the rest of the function.
                }
                this.sequenceIndex = 0;
            }
            if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
                this.sequenceIndex += 1;
            }
            else if (this.sequenceIndex === 0) {
                if (this.currentSequence === Sequences.TitleEnd) {
                    // We have to parse entities in <title> tags.
                    if (this.decodeEntities && c === CharCodes.Amp) {
                        this.state = State.BeforeEntity;
                    }
                }
                else if (this.fastForwardTo(CharCodes.Lt)) {
                    // Outside of <title> tags, we can fast-forward.
                    this.sequenceIndex = 1;
                }
            }
            else {
                // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
                this.sequenceIndex = Number(c === CharCodes.Lt);
            }
        };
        Tokenizer.prototype.stateCDATASequence = function (c) {
            if (c === Sequences.Cdata[this.sequenceIndex]) {
                if (++this.sequenceIndex === Sequences.Cdata.length) {
                    this.state = State.InCommentLike;
                    this.currentSequence = Sequences.CdataEnd;
                    this.sequenceIndex = 0;
                    this.sectionStart = this.index + 1;
                }
            }
            else {
                this.sequenceIndex = 0;
                this.state = State.InDeclaration;
                this.stateInDeclaration(c); // Reconsume the character
            }
        };
        /**
         * When we wait for one specific character, we can speed things up
         * by skipping through the buffer until we find it.
         *
         * @returns Whether the character was found.
         */
        Tokenizer.prototype.fastForwardTo = function (c) {
            while (++this.index < this.buffer.length + this.offset) {
                if (this.buffer.charCodeAt(this.index - this.offset) === c) {
                    return true;
                }
            }
            /*
             * We increment the index at the end of the `parse` loop,
             * so set it to `buffer.length - 1` here.
             *
             * TODO: Refactor `parse` to increment index before calling states.
             */
            this.index = this.buffer.length + this.offset - 1;
            return false;
        };
        /**
         * Comments and CDATA end with `-->` and `]]>`.
         *
         * Their common qualities are:
         * - Their end sequences have a distinct character they start with.
         * - That character is then repeated, so we have to check multiple repeats.
         * - All characters but the start character of the sequence can be skipped.
         */
        Tokenizer.prototype.stateInCommentLike = function (c) {
            if (c === this.currentSequence[this.sequenceIndex]) {
                if (++this.sequenceIndex === this.currentSequence.length) {
                    if (this.currentSequence === Sequences.CdataEnd) {
                        this.cbs.oncdata(this.sectionStart, this.index, 2);
                    }
                    else {
                        this.cbs.oncomment(this.sectionStart, this.index, 2);
                    }
                    this.sequenceIndex = 0;
                    this.sectionStart = this.index + 1;
                    this.state = State.Text;
                }
            }
            else if (this.sequenceIndex === 0) {
                // Fast-forward to the first character of the sequence
                if (this.fastForwardTo(this.currentSequence[0])) {
                    this.sequenceIndex = 1;
                }
            }
            else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
                // Allow long sequences, eg. --->, ]]]>
                this.sequenceIndex = 0;
            }
        };
        /**
         * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
         *
         * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
         * We allow anything that wouldn't end the tag.
         */
        Tokenizer.prototype.isTagStartChar = function (c) {
            return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
        };
        Tokenizer.prototype.startSpecial = function (sequence, offset) {
            this.isSpecial = true;
            this.currentSequence = sequence;
            this.sequenceIndex = offset;
            this.state = State.SpecialStartSequence;
        };
        Tokenizer.prototype.stateBeforeTagName = function (c) {
            if (c === CharCodes.ExclamationMark) {
                this.state = State.BeforeDeclaration;
                this.sectionStart = this.index + 1;
            }
            else if (c === CharCodes.Questionmark) {
                this.state = State.InProcessingInstruction;
                this.sectionStart = this.index + 1;
            }
            else if (this.isTagStartChar(c)) {
                var lower = c | 0x20;
                this.sectionStart = this.index;
                if (!this.xmlMode && lower === Sequences.TitleEnd[2]) {
                    this.startSpecial(Sequences.TitleEnd, 3);
                }
                else {
                    this.state =
                        !this.xmlMode && lower === Sequences.ScriptEnd[2]
                            ? State.BeforeSpecialS
                            : State.InTagName;
                }
            }
            else if (c === CharCodes.Slash) {
                this.state = State.BeforeClosingTagName;
            }
            else {
                this.state = State.Text;
                this.stateText(c);
            }
        };
        Tokenizer.prototype.stateInTagName = function (c) {
            if (isEndOfTagSection(c)) {
                this.cbs.onopentagname(this.sectionStart, this.index);
                this.sectionStart = -1;
                this.state = State.BeforeAttributeName;
                this.stateBeforeAttributeName(c);
            }
        };
        Tokenizer.prototype.stateBeforeClosingTagName = function (c) {
            if (isWhitespace(c)) ;
            else if (c === CharCodes.Gt) {
                this.state = State.Text;
            }
            else {
                this.state = this.isTagStartChar(c)
                    ? State.InClosingTagName
                    : State.InSpecialComment;
                this.sectionStart = this.index;
            }
        };
        Tokenizer.prototype.stateInClosingTagName = function (c) {
            if (c === CharCodes.Gt || isWhitespace(c)) {
                this.cbs.onclosetag(this.sectionStart, this.index);
                this.sectionStart = -1;
                this.state = State.AfterClosingTagName;
                this.stateAfterClosingTagName(c);
            }
        };
        Tokenizer.prototype.stateAfterClosingTagName = function (c) {
            // Skip everything until ">"
            if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
                this.state = State.Text;
                this.sectionStart = this.index + 1;
            }
        };
        Tokenizer.prototype.stateBeforeAttributeName = function (c) {
            if (c === CharCodes.Gt) {
                this.cbs.onopentagend(this.index);
                if (this.isSpecial) {
                    this.state = State.InSpecialTag;
                    this.sequenceIndex = 0;
                }
                else {
                    this.state = State.Text;
                }
                this.baseState = this.state;
                this.sectionStart = this.index + 1;
            }
            else if (c === CharCodes.Slash) {
                this.state = State.InSelfClosingTag;
            }
            else if (!isWhitespace(c)) {
                this.state = State.InAttributeName;
                this.sectionStart = this.index;
            }
        };
        Tokenizer.prototype.stateInSelfClosingTag = function (c) {
            if (c === CharCodes.Gt) {
                this.cbs.onselfclosingtag(this.index);
                this.state = State.Text;
                this.baseState = State.Text;
                this.sectionStart = this.index + 1;
                this.isSpecial = false; // Reset special state, in case of self-closing special tags
            }
            else if (!isWhitespace(c)) {
                this.state = State.BeforeAttributeName;
                this.stateBeforeAttributeName(c);
            }
        };
        Tokenizer.prototype.stateInAttributeName = function (c) {
            if (c === CharCodes.Eq || isEndOfTagSection(c)) {
                this.cbs.onattribname(this.sectionStart, this.index);
                this.sectionStart = -1;
                this.state = State.AfterAttributeName;
                this.stateAfterAttributeName(c);
            }
        };
        Tokenizer.prototype.stateAfterAttributeName = function (c) {
            if (c === CharCodes.Eq) {
                this.state = State.BeforeAttributeValue;
            }
            else if (c === CharCodes.Slash || c === CharCodes.Gt) {
                this.cbs.onattribend(QuoteType.NoValue, this.index);
                this.state = State.BeforeAttributeName;
                this.stateBeforeAttributeName(c);
            }
            else if (!isWhitespace(c)) {
                this.cbs.onattribend(QuoteType.NoValue, this.index);
                this.state = State.InAttributeName;
                this.sectionStart = this.index;
            }
        };
        Tokenizer.prototype.stateBeforeAttributeValue = function (c) {
            if (c === CharCodes.DoubleQuote) {
                this.state = State.InAttributeValueDq;
                this.sectionStart = this.index + 1;
            }
            else if (c === CharCodes.SingleQuote) {
                this.state = State.InAttributeValueSq;
                this.sectionStart = this.index + 1;
            }
            else if (!isWhitespace(c)) {
                this.sectionStart = this.index;
                this.state = State.InAttributeValueNq;
                this.stateInAttributeValueNoQuotes(c); // Reconsume token
            }
        };
        Tokenizer.prototype.handleInAttributeValue = function (c, quote) {
            if (c === quote ||
                (!this.decodeEntities && this.fastForwardTo(quote))) {
                this.cbs.onattribdata(this.sectionStart, this.index);
                this.sectionStart = -1;
                this.cbs.onattribend(quote === CharCodes.DoubleQuote
                    ? QuoteType.Double
                    : QuoteType.Single, this.index);
                this.state = State.BeforeAttributeName;
            }
            else if (this.decodeEntities && c === CharCodes.Amp) {
                this.baseState = this.state;
                this.state = State.BeforeEntity;
            }
        };
        Tokenizer.prototype.stateInAttributeValueDoubleQuotes = function (c) {
            this.handleInAttributeValue(c, CharCodes.DoubleQuote);
        };
        Tokenizer.prototype.stateInAttributeValueSingleQuotes = function (c) {
            this.handleInAttributeValue(c, CharCodes.SingleQuote);
        };
        Tokenizer.prototype.stateInAttributeValueNoQuotes = function (c) {
            if (isWhitespace(c) || c === CharCodes.Gt) {
                this.cbs.onattribdata(this.sectionStart, this.index);
                this.sectionStart = -1;
                this.cbs.onattribend(QuoteType.Unquoted, this.index);
                this.state = State.BeforeAttributeName;
                this.stateBeforeAttributeName(c);
            }
            else if (this.decodeEntities && c === CharCodes.Amp) {
                this.baseState = this.state;
                this.state = State.BeforeEntity;
            }
        };
        Tokenizer.prototype.stateBeforeDeclaration = function (c) {
            if (c === CharCodes.OpeningSquareBracket) {
                this.state = State.CDATASequence;
                this.sequenceIndex = 0;
            }
            else {
                this.state =
                    c === CharCodes.Dash
                        ? State.BeforeComment
                        : State.InDeclaration;
            }
        };
        Tokenizer.prototype.stateInDeclaration = function (c) {
            if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
                this.cbs.ondeclaration(this.sectionStart, this.index);
                this.state = State.Text;
                this.sectionStart = this.index + 1;
            }
        };
        Tokenizer.prototype.stateInProcessingInstruction = function (c) {
            if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
                this.cbs.onprocessinginstruction(this.sectionStart, this.index);
                this.state = State.Text;
                this.sectionStart = this.index + 1;
            }
        };
        Tokenizer.prototype.stateBeforeComment = function (c) {
            if (c === CharCodes.Dash) {
                this.state = State.InCommentLike;
                this.currentSequence = Sequences.CommentEnd;
                // Allow short comments (eg. <!-->)
                this.sequenceIndex = 2;
                this.sectionStart = this.index + 1;
            }
            else {
                this.state = State.InDeclaration;
            }
        };
        Tokenizer.prototype.stateInSpecialComment = function (c) {
            if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
                this.cbs.oncomment(this.sectionStart, this.index, 0);
                this.state = State.Text;
                this.sectionStart = this.index + 1;
            }
        };
        Tokenizer.prototype.stateBeforeSpecialS = function (c) {
            var lower = c | 0x20;
            if (lower === Sequences.ScriptEnd[3]) {
                this.startSpecial(Sequences.ScriptEnd, 4);
            }
            else if (lower === Sequences.StyleEnd[3]) {
                this.startSpecial(Sequences.StyleEnd, 4);
            }
            else {
                this.state = State.InTagName;
                this.stateInTagName(c); // Consume the token again
            }
        };
        Tokenizer.prototype.stateBeforeEntity = function (c) {
            // Start excess with 1 to include the '&'
            this.entityExcess = 1;
            this.entityResult = 0;
            if (c === CharCodes.Num) {
                this.state = State.BeforeNumericEntity;
            }
            else if (c === CharCodes.Amp) ;
            else {
                this.trieIndex = 0;
                this.trieCurrent = this.entityTrie[0];
                this.state = State.InNamedEntity;
                this.stateInNamedEntity(c);
            }
        };
        Tokenizer.prototype.stateInNamedEntity = function (c) {
            this.entityExcess += 1;
            this.trieIndex = (0, decode_js_1.determineBranch)(this.entityTrie, this.trieCurrent, this.trieIndex + 1, c);
            if (this.trieIndex < 0) {
                this.emitNamedEntity();
                this.index--;
                return;
            }
            this.trieCurrent = this.entityTrie[this.trieIndex];
            var masked = this.trieCurrent & decode_js_1.BinTrieFlags.VALUE_LENGTH;
            // If the branch is a value, store it and continue
            if (masked) {
                // The mask is the number of bytes of the value, including the current byte.
                var valueLength = (masked >> 14) - 1;
                // If we have a legacy entity while parsing strictly, just skip the number of bytes
                if (!this.allowLegacyEntity() && c !== CharCodes.Semi) {
                    this.trieIndex += valueLength;
                }
                else {
                    // Add 1 as we have already incremented the excess
                    var entityStart = this.index - this.entityExcess + 1;
                    if (entityStart > this.sectionStart) {
                        this.emitPartial(this.sectionStart, entityStart);
                    }
                    // If this is a surrogate pair, consume the next two bytes
                    this.entityResult = this.trieIndex;
                    this.trieIndex += valueLength;
                    this.entityExcess = 0;
                    this.sectionStart = this.index + 1;
                    if (valueLength === 0) {
                        this.emitNamedEntity();
                    }
                }
            }
        };
        Tokenizer.prototype.emitNamedEntity = function () {
            this.state = this.baseState;
            if (this.entityResult === 0) {
                return;
            }
            var valueLength = (this.entityTrie[this.entityResult] & decode_js_1.BinTrieFlags.VALUE_LENGTH) >>
                14;
            switch (valueLength) {
                case 1:
                    this.emitCodePoint(this.entityTrie[this.entityResult] &
                        ~decode_js_1.BinTrieFlags.VALUE_LENGTH);
                    break;
                case 2:
                    this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
                    break;
                case 3: {
                    this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
                    this.emitCodePoint(this.entityTrie[this.entityResult + 2]);
                }
            }
        };
        Tokenizer.prototype.stateBeforeNumericEntity = function (c) {
            if ((c | 0x20) === CharCodes.LowerX) {
                this.entityExcess++;
                this.state = State.InHexEntity;
            }
            else {
                this.state = State.InNumericEntity;
                this.stateInNumericEntity(c);
            }
        };
        Tokenizer.prototype.emitNumericEntity = function (strict) {
            var entityStart = this.index - this.entityExcess - 1;
            var numberStart = entityStart + 2 + Number(this.state === State.InHexEntity);
            if (numberStart !== this.index) {
                // Emit leading data if any
                if (entityStart > this.sectionStart) {
                    this.emitPartial(this.sectionStart, entityStart);
                }
                this.sectionStart = this.index + Number(strict);
                this.emitCodePoint((0, decode_js_1.replaceCodePoint)(this.entityResult));
            }
            this.state = this.baseState;
        };
        Tokenizer.prototype.stateInNumericEntity = function (c) {
            if (c === CharCodes.Semi) {
                this.emitNumericEntity(true);
            }
            else if (isNumber(c)) {
                this.entityResult = this.entityResult * 10 + (c - CharCodes.Zero);
                this.entityExcess++;
            }
            else {
                if (this.allowLegacyEntity()) {
                    this.emitNumericEntity(false);
                }
                else {
                    this.state = this.baseState;
                }
                this.index--;
            }
        };
        Tokenizer.prototype.stateInHexEntity = function (c) {
            if (c === CharCodes.Semi) {
                this.emitNumericEntity(true);
            }
            else if (isNumber(c)) {
                this.entityResult = this.entityResult * 16 + (c - CharCodes.Zero);
                this.entityExcess++;
            }
            else if (isHexDigit(c)) {
                this.entityResult =
                    this.entityResult * 16 + ((c | 0x20) - CharCodes.LowerA + 10);
                this.entityExcess++;
            }
            else {
                if (this.allowLegacyEntity()) {
                    this.emitNumericEntity(false);
                }
                else {
                    this.state = this.baseState;
                }
                this.index--;
            }
        };
        Tokenizer.prototype.allowLegacyEntity = function () {
            return (!this.xmlMode &&
                (this.baseState === State.Text ||
                    this.baseState === State.InSpecialTag));
        };
        /**
         * Remove data that has already been consumed from the buffer.
         */
        Tokenizer.prototype.cleanup = function () {
            // If we are inside of text or attributes, emit what we already have.
            if (this.running && this.sectionStart !== this.index) {
                if (this.state === State.Text ||
                    (this.state === State.InSpecialTag && this.sequenceIndex === 0)) {
                    this.cbs.ontext(this.sectionStart, this.index);
                    this.sectionStart = this.index;
                }
                else if (this.state === State.InAttributeValueDq ||
                    this.state === State.InAttributeValueSq ||
                    this.state === State.InAttributeValueNq) {
                    this.cbs.onattribdata(this.sectionStart, this.index);
                    this.sectionStart = this.index;
                }
            }
        };
        Tokenizer.prototype.shouldContinue = function () {
            return this.index < this.buffer.length + this.offset && this.running;
        };
        /**
         * Iterates through the buffer, calling the function corresponding to the current state.
         *
         * States that are more likely to be hit are higher up, as a performance improvement.
         */
        Tokenizer.prototype.parse = function () {
            while (this.shouldContinue()) {
                var c = this.buffer.charCodeAt(this.index - this.offset);
                if (this.state === State.Text) {
                    this.stateText(c);
                }
                else if (this.state === State.SpecialStartSequence) {
                    this.stateSpecialStartSequence(c);
                }
                else if (this.state === State.InSpecialTag) {
                    this.stateInSpecialTag(c);
                }
                else if (this.state === State.CDATASequence) {
                    this.stateCDATASequence(c);
                }
                else if (this.state === State.InAttributeValueDq) {
                    this.stateInAttributeValueDoubleQuotes(c);
                }
                else if (this.state === State.InAttributeName) {
                    this.stateInAttributeName(c);
                }
                else if (this.state === State.InCommentLike) {
                    this.stateInCommentLike(c);
                }
                else if (this.state === State.InSpecialComment) {
                    this.stateInSpecialComment(c);
                }
                else if (this.state === State.BeforeAttributeName) {
                    this.stateBeforeAttributeName(c);
                }
                else if (this.state === State.InTagName) {
                    this.stateInTagName(c);
                }
                else if (this.state === State.InClosingTagName) {
                    this.stateInClosingTagName(c);
                }
                else if (this.state === State.BeforeTagName) {
                    this.stateBeforeTagName(c);
                }
                else if (this.state === State.AfterAttributeName) {
                    this.stateAfterAttributeName(c);
                }
                else if (this.state === State.InAttributeValueSq) {
                    this.stateInAttributeValueSingleQuotes(c);
                }
                else if (this.state === State.BeforeAttributeValue) {
                    this.stateBeforeAttributeValue(c);
                }
                else if (this.state === State.BeforeClosingTagName) {
                    this.stateBeforeClosingTagName(c);
                }
                else if (this.state === State.AfterClosingTagName) {
                    this.stateAfterClosingTagName(c);
                }
                else if (this.state === State.BeforeSpecialS) {
                    this.stateBeforeSpecialS(c);
                }
                else if (this.state === State.InAttributeValueNq) {
                    this.stateInAttributeValueNoQuotes(c);
                }
                else if (this.state === State.InSelfClosingTag) {
                    this.stateInSelfClosingTag(c);
                }
                else if (this.state === State.InDeclaration) {
                    this.stateInDeclaration(c);
                }
                else if (this.state === State.BeforeDeclaration) {
                    this.stateBeforeDeclaration(c);
                }
                else if (this.state === State.BeforeComment) {
                    this.stateBeforeComment(c);
                }
                else if (this.state === State.InProcessingInstruction) {
                    this.stateInProcessingInstruction(c);
                }
                else if (this.state === State.InNamedEntity) {
                    this.stateInNamedEntity(c);
                }
                else if (this.state === State.BeforeEntity) {
                    this.stateBeforeEntity(c);
                }
                else if (this.state === State.InHexEntity) {
                    this.stateInHexEntity(c);
                }
                else if (this.state === State.InNumericEntity) {
                    this.stateInNumericEntity(c);
                }
                else {
                    // `this._state === State.BeforeNumericEntity`
                    this.stateBeforeNumericEntity(c);
                }
                this.index++;
            }
            this.cleanup();
        };
        Tokenizer.prototype.finish = function () {
            if (this.state === State.InNamedEntity) {
                this.emitNamedEntity();
            }
            // If there is remaining data, emit it in a reasonable way
            if (this.sectionStart < this.index) {
                this.handleTrailingData();
            }
            this.cbs.onend();
        };
        /** Handle any trailing data. */
        Tokenizer.prototype.handleTrailingData = function () {
            var endIndex = this.buffer.length + this.offset;
            if (this.state === State.InCommentLike) {
                if (this.currentSequence === Sequences.CdataEnd) {
                    this.cbs.oncdata(this.sectionStart, endIndex, 0);
                }
                else {
                    this.cbs.oncomment(this.sectionStart, endIndex, 0);
                }
            }
            else if (this.state === State.InNumericEntity &&
                this.allowLegacyEntity()) {
                this.emitNumericEntity(false);
                // All trailing data will have been consumed
            }
            else if (this.state === State.InHexEntity &&
                this.allowLegacyEntity()) {
                this.emitNumericEntity(false);
                // All trailing data will have been consumed
            }
            else if (this.state === State.InTagName ||
                this.state === State.BeforeAttributeName ||
                this.state === State.BeforeAttributeValue ||
                this.state === State.AfterAttributeName ||
                this.state === State.InAttributeName ||
                this.state === State.InAttributeValueSq ||
                this.state === State.InAttributeValueDq ||
                this.state === State.InAttributeValueNq ||
                this.state === State.InClosingTagName) ;
            else {
                this.cbs.ontext(this.sectionStart, endIndex);
            }
        };
        Tokenizer.prototype.emitPartial = function (start, endIndex) {
            if (this.baseState !== State.Text &&
                this.baseState !== State.InSpecialTag) {
                this.cbs.onattribdata(start, endIndex);
            }
            else {
                this.cbs.ontext(start, endIndex);
            }
        };
        Tokenizer.prototype.emitCodePoint = function (cp) {
            if (this.baseState !== State.Text &&
                this.baseState !== State.InSpecialTag) {
                this.cbs.onattribentity(cp);
            }
            else {
                this.cbs.ontextentity(cp);
            }
        };
        return Tokenizer;
    }());
    exports.default = Tokenizer;

    });

    var Tokenizer_js_1 = Tokenizer_1;

    var Parser_1 = createCommonjsModule(function (module, exports) {
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    });
    var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Parser = void 0;
    var Tokenizer_js_1$1 = __importStar(Tokenizer_js_1);

    var formTags = new Set([
        "input",
        "option",
        "optgroup",
        "select",
        "button",
        "datalist",
        "textarea",
    ]);
    var pTag = new Set(["p"]);
    var tableSectionTags = new Set(["thead", "tbody"]);
    var ddtTags = new Set(["dd", "dt"]);
    var rtpTags = new Set(["rt", "rp"]);
    var openImpliesClose = new Map([
        ["tr", new Set(["tr", "th", "td"])],
        ["th", new Set(["th"])],
        ["td", new Set(["thead", "th", "td"])],
        ["body", new Set(["head", "link", "script"])],
        ["li", new Set(["li"])],
        ["p", pTag],
        ["h1", pTag],
        ["h2", pTag],
        ["h3", pTag],
        ["h4", pTag],
        ["h5", pTag],
        ["h6", pTag],
        ["select", formTags],
        ["input", formTags],
        ["output", formTags],
        ["button", formTags],
        ["datalist", formTags],
        ["textarea", formTags],
        ["option", new Set(["option"])],
        ["optgroup", new Set(["optgroup", "option"])],
        ["dd", ddtTags],
        ["dt", ddtTags],
        ["address", pTag],
        ["article", pTag],
        ["aside", pTag],
        ["blockquote", pTag],
        ["details", pTag],
        ["div", pTag],
        ["dl", pTag],
        ["fieldset", pTag],
        ["figcaption", pTag],
        ["figure", pTag],
        ["footer", pTag],
        ["form", pTag],
        ["header", pTag],
        ["hr", pTag],
        ["main", pTag],
        ["nav", pTag],
        ["ol", pTag],
        ["pre", pTag],
        ["section", pTag],
        ["table", pTag],
        ["ul", pTag],
        ["rt", rtpTags],
        ["rp", rtpTags],
        ["tbody", tableSectionTags],
        ["tfoot", tableSectionTags],
    ]);
    var voidElements = new Set([
        "area",
        "base",
        "basefont",
        "br",
        "col",
        "command",
        "embed",
        "frame",
        "hr",
        "img",
        "input",
        "isindex",
        "keygen",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    ]);
    var foreignContextElements = new Set(["math", "svg"]);
    var htmlIntegrationElements = new Set([
        "mi",
        "mo",
        "mn",
        "ms",
        "mtext",
        "annotation-xml",
        "foreignobject",
        "desc",
        "title",
    ]);
    var reNameEnd = /\s|\//;
    var Parser = /** @class */ (function () {
        function Parser(cbs, options) {
            if (options === void 0) { options = {}; }
            var _a, _b, _c, _d, _e;
            this.options = options;
            /** The start index of the last event. */
            this.startIndex = 0;
            /** The end index of the last event. */
            this.endIndex = 0;
            /**
             * Store the start index of the current open tag,
             * so we can update the start index for attributes.
             */
            this.openTagStart = 0;
            this.tagname = "";
            this.attribname = "";
            this.attribvalue = "";
            this.attribs = null;
            this.stack = [];
            this.foreignContext = [];
            this.buffers = [];
            this.bufferOffset = 0;
            /** The index of the last written buffer. Used when resuming after a `pause()`. */
            this.writeIndex = 0;
            /** Indicates whether the parser has finished running / `.end` has been called. */
            this.ended = false;
            this.cbs = cbs !== null && cbs !== void 0 ? cbs : {};
            this.lowerCaseTagNames = (_a = options.lowerCaseTags) !== null && _a !== void 0 ? _a : !options.xmlMode;
            this.lowerCaseAttributeNames =
                (_b = options.lowerCaseAttributeNames) !== null && _b !== void 0 ? _b : !options.xmlMode;
            this.tokenizer = new ((_c = options.Tokenizer) !== null && _c !== void 0 ? _c : Tokenizer_js_1$1.default)(this.options, this);
            (_e = (_d = this.cbs).onparserinit) === null || _e === void 0 ? void 0 : _e.call(_d, this);
        }
        // Tokenizer event handlers
        /** @internal */
        Parser.prototype.ontext = function (start, endIndex) {
            var _a, _b;
            var data = this.getSlice(start, endIndex);
            this.endIndex = endIndex - 1;
            (_b = (_a = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a, data);
            this.startIndex = endIndex;
        };
        /** @internal */
        Parser.prototype.ontextentity = function (cp) {
            var _a, _b;
            /*
             * Entities can be emitted on the character, or directly after.
             * We use the section start here to get accurate indices.
             */
            var idx = this.tokenizer.getSectionStart();
            this.endIndex = idx - 1;
            (_b = (_a = this.cbs).ontext) === null || _b === void 0 ? void 0 : _b.call(_a, (0, decode_js_1.fromCodePoint)(cp));
            this.startIndex = idx;
        };
        Parser.prototype.isVoidElement = function (name) {
            return !this.options.xmlMode && voidElements.has(name);
        };
        /** @internal */
        Parser.prototype.onopentagname = function (start, endIndex) {
            this.endIndex = endIndex;
            var name = this.getSlice(start, endIndex);
            if (this.lowerCaseTagNames) {
                name = name.toLowerCase();
            }
            this.emitOpenTag(name);
        };
        Parser.prototype.emitOpenTag = function (name) {
            var _a, _b, _c, _d;
            this.openTagStart = this.startIndex;
            this.tagname = name;
            var impliesClose = !this.options.xmlMode && openImpliesClose.get(name);
            if (impliesClose) {
                while (this.stack.length > 0 &&
                    impliesClose.has(this.stack[this.stack.length - 1])) {
                    var el = this.stack.pop();
                    (_b = (_a = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a, el, true);
                }
            }
            if (!this.isVoidElement(name)) {
                this.stack.push(name);
                if (foreignContextElements.has(name)) {
                    this.foreignContext.push(true);
                }
                else if (htmlIntegrationElements.has(name)) {
                    this.foreignContext.push(false);
                }
            }
            (_d = (_c = this.cbs).onopentagname) === null || _d === void 0 ? void 0 : _d.call(_c, name);
            if (this.cbs.onopentag)
                this.attribs = {};
        };
        Parser.prototype.endOpenTag = function (isImplied) {
            var _a, _b;
            this.startIndex = this.openTagStart;
            if (this.attribs) {
                (_b = (_a = this.cbs).onopentag) === null || _b === void 0 ? void 0 : _b.call(_a, this.tagname, this.attribs, isImplied);
                this.attribs = null;
            }
            if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
                this.cbs.onclosetag(this.tagname, true);
            }
            this.tagname = "";
        };
        /** @internal */
        Parser.prototype.onopentagend = function (endIndex) {
            this.endIndex = endIndex;
            this.endOpenTag(false);
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.onclosetag = function (start, endIndex) {
            var _a, _b, _c, _d, _e, _f;
            this.endIndex = endIndex;
            var name = this.getSlice(start, endIndex);
            if (this.lowerCaseTagNames) {
                name = name.toLowerCase();
            }
            if (foreignContextElements.has(name) ||
                htmlIntegrationElements.has(name)) {
                this.foreignContext.pop();
            }
            if (!this.isVoidElement(name)) {
                var pos = this.stack.lastIndexOf(name);
                if (pos !== -1) {
                    if (this.cbs.onclosetag) {
                        var count = this.stack.length - pos;
                        while (count--) {
                            // We know the stack has sufficient elements.
                            this.cbs.onclosetag(this.stack.pop(), count !== 0);
                        }
                    }
                    else
                        this.stack.length = pos;
                }
                else if (!this.options.xmlMode && name === "p") {
                    // Implicit open before close
                    this.emitOpenTag("p");
                    this.closeCurrentTag(true);
                }
            }
            else if (!this.options.xmlMode && name === "br") {
                // We can't use `emitOpenTag` for implicit open, as `br` would be implicitly closed.
                (_b = (_a = this.cbs).onopentagname) === null || _b === void 0 ? void 0 : _b.call(_a, "br");
                (_d = (_c = this.cbs).onopentag) === null || _d === void 0 ? void 0 : _d.call(_c, "br", {}, true);
                (_f = (_e = this.cbs).onclosetag) === null || _f === void 0 ? void 0 : _f.call(_e, "br", false);
            }
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.onselfclosingtag = function (endIndex) {
            this.endIndex = endIndex;
            if (this.options.xmlMode ||
                this.options.recognizeSelfClosing ||
                this.foreignContext[this.foreignContext.length - 1]) {
                this.closeCurrentTag(false);
                // Set `startIndex` for next node
                this.startIndex = endIndex + 1;
            }
            else {
                // Ignore the fact that the tag is self-closing.
                this.onopentagend(endIndex);
            }
        };
        Parser.prototype.closeCurrentTag = function (isOpenImplied) {
            var _a, _b;
            var name = this.tagname;
            this.endOpenTag(isOpenImplied);
            // Self-closing tags will be on the top of the stack
            if (this.stack[this.stack.length - 1] === name) {
                // If the opening tag isn't implied, the closing tag has to be implied.
                (_b = (_a = this.cbs).onclosetag) === null || _b === void 0 ? void 0 : _b.call(_a, name, !isOpenImplied);
                this.stack.pop();
            }
        };
        /** @internal */
        Parser.prototype.onattribname = function (start, endIndex) {
            this.startIndex = start;
            var name = this.getSlice(start, endIndex);
            this.attribname = this.lowerCaseAttributeNames
                ? name.toLowerCase()
                : name;
        };
        /** @internal */
        Parser.prototype.onattribdata = function (start, endIndex) {
            this.attribvalue += this.getSlice(start, endIndex);
        };
        /** @internal */
        Parser.prototype.onattribentity = function (cp) {
            this.attribvalue += (0, decode_js_1.fromCodePoint)(cp);
        };
        /** @internal */
        Parser.prototype.onattribend = function (quote, endIndex) {
            var _a, _b;
            this.endIndex = endIndex;
            (_b = (_a = this.cbs).onattribute) === null || _b === void 0 ? void 0 : _b.call(_a, this.attribname, this.attribvalue, quote === Tokenizer_js_1$1.QuoteType.Double
                ? '"'
                : quote === Tokenizer_js_1$1.QuoteType.Single
                    ? "'"
                    : quote === Tokenizer_js_1$1.QuoteType.NoValue
                        ? undefined
                        : null);
            if (this.attribs &&
                !Object.prototype.hasOwnProperty.call(this.attribs, this.attribname)) {
                this.attribs[this.attribname] = this.attribvalue;
            }
            this.attribvalue = "";
        };
        Parser.prototype.getInstructionName = function (value) {
            var idx = value.search(reNameEnd);
            var name = idx < 0 ? value : value.substr(0, idx);
            if (this.lowerCaseTagNames) {
                name = name.toLowerCase();
            }
            return name;
        };
        /** @internal */
        Parser.prototype.ondeclaration = function (start, endIndex) {
            this.endIndex = endIndex;
            var value = this.getSlice(start, endIndex);
            if (this.cbs.onprocessinginstruction) {
                var name = this.getInstructionName(value);
                this.cbs.onprocessinginstruction("!".concat(name), "!".concat(value));
            }
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.onprocessinginstruction = function (start, endIndex) {
            this.endIndex = endIndex;
            var value = this.getSlice(start, endIndex);
            if (this.cbs.onprocessinginstruction) {
                var name = this.getInstructionName(value);
                this.cbs.onprocessinginstruction("?".concat(name), "?".concat(value));
            }
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.oncomment = function (start, endIndex, offset) {
            var _a, _b, _c, _d;
            this.endIndex = endIndex;
            (_b = (_a = this.cbs).oncomment) === null || _b === void 0 ? void 0 : _b.call(_a, this.getSlice(start, endIndex - offset));
            (_d = (_c = this.cbs).oncommentend) === null || _d === void 0 ? void 0 : _d.call(_c);
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.oncdata = function (start, endIndex, offset) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            this.endIndex = endIndex;
            var value = this.getSlice(start, endIndex - offset);
            if (this.options.xmlMode || this.options.recognizeCDATA) {
                (_b = (_a = this.cbs).oncdatastart) === null || _b === void 0 ? void 0 : _b.call(_a);
                (_d = (_c = this.cbs).ontext) === null || _d === void 0 ? void 0 : _d.call(_c, value);
                (_f = (_e = this.cbs).oncdataend) === null || _f === void 0 ? void 0 : _f.call(_e);
            }
            else {
                (_h = (_g = this.cbs).oncomment) === null || _h === void 0 ? void 0 : _h.call(_g, "[CDATA[".concat(value, "]]"));
                (_k = (_j = this.cbs).oncommentend) === null || _k === void 0 ? void 0 : _k.call(_j);
            }
            // Set `startIndex` for next node
            this.startIndex = endIndex + 1;
        };
        /** @internal */
        Parser.prototype.onend = function () {
            var _a, _b;
            if (this.cbs.onclosetag) {
                // Set the end index for all remaining tags
                this.endIndex = this.startIndex;
                for (var i = this.stack.length; i > 0; this.cbs.onclosetag(this.stack[--i], true))
                    ;
            }
            (_b = (_a = this.cbs).onend) === null || _b === void 0 ? void 0 : _b.call(_a);
        };
        /**
         * Resets the parser to a blank state, ready to parse a new HTML document
         */
        Parser.prototype.reset = function () {
            var _a, _b, _c, _d;
            (_b = (_a = this.cbs).onreset) === null || _b === void 0 ? void 0 : _b.call(_a);
            this.tokenizer.reset();
            this.tagname = "";
            this.attribname = "";
            this.attribs = null;
            this.stack.length = 0;
            this.startIndex = 0;
            this.endIndex = 0;
            (_d = (_c = this.cbs).onparserinit) === null || _d === void 0 ? void 0 : _d.call(_c, this);
            this.buffers.length = 0;
            this.bufferOffset = 0;
            this.writeIndex = 0;
            this.ended = false;
        };
        /**
         * Resets the parser, then parses a complete document and
         * pushes it to the handler.
         *
         * @param data Document to parse.
         */
        Parser.prototype.parseComplete = function (data) {
            this.reset();
            this.end(data);
        };
        Parser.prototype.getSlice = function (start, end) {
            while (start - this.bufferOffset >= this.buffers[0].length) {
                this.shiftBuffer();
            }
            var str = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
            while (end - this.bufferOffset > this.buffers[0].length) {
                this.shiftBuffer();
                str += this.buffers[0].slice(0, end - this.bufferOffset);
            }
            return str;
        };
        Parser.prototype.shiftBuffer = function () {
            this.bufferOffset += this.buffers[0].length;
            this.writeIndex--;
            this.buffers.shift();
        };
        /**
         * Parses a chunk of data and calls the corresponding callbacks.
         *
         * @param chunk Chunk to parse.
         */
        Parser.prototype.write = function (chunk) {
            var _a, _b;
            if (this.ended) {
                (_b = (_a = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a, new Error(".write() after done!"));
                return;
            }
            this.buffers.push(chunk);
            if (this.tokenizer.running) {
                this.tokenizer.write(chunk);
                this.writeIndex++;
            }
        };
        /**
         * Parses the end of the buffer and clears the stack, calls onend.
         *
         * @param chunk Optional final chunk to parse.
         */
        Parser.prototype.end = function (chunk) {
            var _a, _b;
            if (this.ended) {
                (_b = (_a = this.cbs).onerror) === null || _b === void 0 ? void 0 : _b.call(_a, Error(".end() after done!"));
                return;
            }
            if (chunk)
                this.write(chunk);
            this.ended = true;
            this.tokenizer.end();
        };
        /**
         * Pauses parsing. The parser won't emit events until `resume` is called.
         */
        Parser.prototype.pause = function () {
            this.tokenizer.pause();
        };
        /**
         * Resumes parsing after `pause` was called.
         */
        Parser.prototype.resume = function () {
            this.tokenizer.resume();
            while (this.tokenizer.running &&
                this.writeIndex < this.buffers.length) {
                this.tokenizer.write(this.buffers[this.writeIndex++]);
            }
            if (this.ended)
                this.tokenizer.end();
        };
        /**
         * Alias of `write`, for backwards compatibility.
         *
         * @param chunk Chunk to parse.
         * @deprecated
         */
        Parser.prototype.parseChunk = function (chunk) {
            this.write(chunk);
        };
        /**
         * Alias of `end`, for backwards compatibility.
         *
         * @param chunk Optional final chunk to parse.
         * @deprecated
         */
        Parser.prototype.done = function (chunk) {
            this.end(chunk);
        };
        return Parser;
    }());
    exports.Parser = Parser;

    });

    var lib$5 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.Doctype = exports.CDATA = exports.Tag = exports.Style = exports.Script = exports.Comment = exports.Directive = exports.Text = exports.Root = exports.isTag = exports.ElementType = void 0;
    /** Types of elements found in htmlparser2's DOM */
    var ElementType;
    (function (ElementType) {
        /** Type for the root element of a document */
        ElementType["Root"] = "root";
        /** Type for Text */
        ElementType["Text"] = "text";
        /** Type for <? ... ?> */
        ElementType["Directive"] = "directive";
        /** Type for <!-- ... --> */
        ElementType["Comment"] = "comment";
        /** Type for <script> tags */
        ElementType["Script"] = "script";
        /** Type for <style> tags */
        ElementType["Style"] = "style";
        /** Type for Any tag */
        ElementType["Tag"] = "tag";
        /** Type for <![CDATA[ ... ]]> */
        ElementType["CDATA"] = "cdata";
        /** Type for <!doctype ...> */
        ElementType["Doctype"] = "doctype";
    })(ElementType = exports.ElementType || (exports.ElementType = {}));
    /**
     * Tests whether an element is a tag or not.
     *
     * @param elem Element to test
     */
    function isTag(elem) {
        return (elem.type === ElementType.Tag ||
            elem.type === ElementType.Script ||
            elem.type === ElementType.Style);
    }
    exports.isTag = isTag;
    // Exports for backwards compatibility
    /** Type for the root element of a document */
    exports.Root = ElementType.Root;
    /** Type for Text */
    exports.Text = ElementType.Text;
    /** Type for <? ... ?> */
    exports.Directive = ElementType.Directive;
    /** Type for <!-- ... --> */
    exports.Comment = ElementType.Comment;
    /** Type for <script> tags */
    exports.Script = ElementType.Script;
    /** Type for <style> tags */
    exports.Style = ElementType.Style;
    /** Type for Any tag */
    exports.Tag = ElementType.Tag;
    /** Type for <![CDATA[ ... ]]> */
    exports.CDATA = ElementType.CDATA;
    /** Type for <!doctype ...> */
    exports.Doctype = ElementType.Doctype;
    });

    var require$$0$3 = lib$5;

    var node = createCommonjsModule(function (module, exports) {
    var __extends = (commonjsGlobal && commonjsGlobal.__extends) || (function () {
        var extendStatics = function (d, b) {
            extendStatics = Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
                function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
            return extendStatics(d, b);
        };
        return function (d, b) {
            if (typeof b !== "function" && b !== null)
                throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
            extendStatics(d, b);
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };
    })();
    var __assign = (commonjsGlobal && commonjsGlobal.__assign) || function () {
        __assign = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.cloneNode = exports.hasChildren = exports.isDocument = exports.isDirective = exports.isComment = exports.isText = exports.isCDATA = exports.isTag = exports.Element = exports.Document = exports.CDATA = exports.NodeWithChildren = exports.ProcessingInstruction = exports.Comment = exports.Text = exports.DataNode = exports.Node = void 0;

    /**
     * This object will be used as the prototype for Nodes when creating a
     * DOM-Level-1-compliant structure.
     */
    var Node = /** @class */ (function () {
        function Node() {
            /** Parent of the node */
            this.parent = null;
            /** Previous sibling */
            this.prev = null;
            /** Next sibling */
            this.next = null;
            /** The start index of the node. Requires `withStartIndices` on the handler to be `true. */
            this.startIndex = null;
            /** The end index of the node. Requires `withEndIndices` on the handler to be `true. */
            this.endIndex = null;
        }
        Object.defineProperty(Node.prototype, "parentNode", {
            // Read-write aliases for properties
            /**
             * Same as {@link parent}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.parent;
            },
            set: function (parent) {
                this.parent = parent;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "previousSibling", {
            /**
             * Same as {@link prev}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.prev;
            },
            set: function (prev) {
                this.prev = prev;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Node.prototype, "nextSibling", {
            /**
             * Same as {@link next}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.next;
            },
            set: function (next) {
                this.next = next;
            },
            enumerable: false,
            configurable: true
        });
        /**
         * Clone this node, and optionally its children.
         *
         * @param recursive Clone child nodes as well.
         * @returns A clone of the node.
         */
        Node.prototype.cloneNode = function (recursive) {
            if (recursive === void 0) { recursive = false; }
            return cloneNode(this, recursive);
        };
        return Node;
    }());
    exports.Node = Node;
    /**
     * A node that contains some data.
     */
    var DataNode = /** @class */ (function (_super) {
        __extends(DataNode, _super);
        /**
         * @param data The content of the data node
         */
        function DataNode(data) {
            var _this = _super.call(this) || this;
            _this.data = data;
            return _this;
        }
        Object.defineProperty(DataNode.prototype, "nodeValue", {
            /**
             * Same as {@link data}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.data;
            },
            set: function (data) {
                this.data = data;
            },
            enumerable: false,
            configurable: true
        });
        return DataNode;
    }(Node));
    exports.DataNode = DataNode;
    /**
     * Text within the document.
     */
    var Text = /** @class */ (function (_super) {
        __extends(Text, _super);
        function Text() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.type = require$$0$3.ElementType.Text;
            return _this;
        }
        Object.defineProperty(Text.prototype, "nodeType", {
            get: function () {
                return 3;
            },
            enumerable: false,
            configurable: true
        });
        return Text;
    }(DataNode));
    exports.Text = Text;
    /**
     * Comments within the document.
     */
    var Comment = /** @class */ (function (_super) {
        __extends(Comment, _super);
        function Comment() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.type = require$$0$3.ElementType.Comment;
            return _this;
        }
        Object.defineProperty(Comment.prototype, "nodeType", {
            get: function () {
                return 8;
            },
            enumerable: false,
            configurable: true
        });
        return Comment;
    }(DataNode));
    exports.Comment = Comment;
    /**
     * Processing instructions, including doc types.
     */
    var ProcessingInstruction = /** @class */ (function (_super) {
        __extends(ProcessingInstruction, _super);
        function ProcessingInstruction(name, data) {
            var _this = _super.call(this, data) || this;
            _this.name = name;
            _this.type = require$$0$3.ElementType.Directive;
            return _this;
        }
        Object.defineProperty(ProcessingInstruction.prototype, "nodeType", {
            get: function () {
                return 1;
            },
            enumerable: false,
            configurable: true
        });
        return ProcessingInstruction;
    }(DataNode));
    exports.ProcessingInstruction = ProcessingInstruction;
    /**
     * A `Node` that can have children.
     */
    var NodeWithChildren = /** @class */ (function (_super) {
        __extends(NodeWithChildren, _super);
        /**
         * @param children Children of the node. Only certain node types can have children.
         */
        function NodeWithChildren(children) {
            var _this = _super.call(this) || this;
            _this.children = children;
            return _this;
        }
        Object.defineProperty(NodeWithChildren.prototype, "firstChild", {
            // Aliases
            /** First child of the node. */
            get: function () {
                var _a;
                return (_a = this.children[0]) !== null && _a !== void 0 ? _a : null;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(NodeWithChildren.prototype, "lastChild", {
            /** Last child of the node. */
            get: function () {
                return this.children.length > 0
                    ? this.children[this.children.length - 1]
                    : null;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(NodeWithChildren.prototype, "childNodes", {
            /**
             * Same as {@link children}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.children;
            },
            set: function (children) {
                this.children = children;
            },
            enumerable: false,
            configurable: true
        });
        return NodeWithChildren;
    }(Node));
    exports.NodeWithChildren = NodeWithChildren;
    var CDATA = /** @class */ (function (_super) {
        __extends(CDATA, _super);
        function CDATA() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.type = require$$0$3.ElementType.CDATA;
            return _this;
        }
        Object.defineProperty(CDATA.prototype, "nodeType", {
            get: function () {
                return 4;
            },
            enumerable: false,
            configurable: true
        });
        return CDATA;
    }(NodeWithChildren));
    exports.CDATA = CDATA;
    /**
     * The root node of the document.
     */
    var Document = /** @class */ (function (_super) {
        __extends(Document, _super);
        function Document() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.type = require$$0$3.ElementType.Root;
            return _this;
        }
        Object.defineProperty(Document.prototype, "nodeType", {
            get: function () {
                return 9;
            },
            enumerable: false,
            configurable: true
        });
        return Document;
    }(NodeWithChildren));
    exports.Document = Document;
    /**
     * An element within the DOM.
     */
    var Element = /** @class */ (function (_super) {
        __extends(Element, _super);
        /**
         * @param name Name of the tag, eg. `div`, `span`.
         * @param attribs Object mapping attribute names to attribute values.
         * @param children Children of the node.
         */
        function Element(name, attribs, children, type) {
            if (children === void 0) { children = []; }
            if (type === void 0) { type = name === "script"
                ? require$$0$3.ElementType.Script
                : name === "style"
                    ? require$$0$3.ElementType.Style
                    : require$$0$3.ElementType.Tag; }
            var _this = _super.call(this, children) || this;
            _this.name = name;
            _this.attribs = attribs;
            _this.type = type;
            return _this;
        }
        Object.defineProperty(Element.prototype, "nodeType", {
            get: function () {
                return 1;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Element.prototype, "tagName", {
            // DOM Level 1 aliases
            /**
             * Same as {@link name}.
             * [DOM spec](https://dom.spec.whatwg.org)-compatible alias.
             */
            get: function () {
                return this.name;
            },
            set: function (name) {
                this.name = name;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Element.prototype, "attributes", {
            get: function () {
                var _this = this;
                return Object.keys(this.attribs).map(function (name) {
                    var _a, _b;
                    return ({
                        name: name,
                        value: _this.attribs[name],
                        namespace: (_a = _this["x-attribsNamespace"]) === null || _a === void 0 ? void 0 : _a[name],
                        prefix: (_b = _this["x-attribsPrefix"]) === null || _b === void 0 ? void 0 : _b[name],
                    });
                });
            },
            enumerable: false,
            configurable: true
        });
        return Element;
    }(NodeWithChildren));
    exports.Element = Element;
    /**
     * @param node Node to check.
     * @returns `true` if the node is a `Element`, `false` otherwise.
     */
    function isTag(node) {
        return (0, require$$0$3.isTag)(node);
    }
    exports.isTag = isTag;
    /**
     * @param node Node to check.
     * @returns `true` if the node has the type `CDATA`, `false` otherwise.
     */
    function isCDATA(node) {
        return node.type === require$$0$3.ElementType.CDATA;
    }
    exports.isCDATA = isCDATA;
    /**
     * @param node Node to check.
     * @returns `true` if the node has the type `Text`, `false` otherwise.
     */
    function isText(node) {
        return node.type === require$$0$3.ElementType.Text;
    }
    exports.isText = isText;
    /**
     * @param node Node to check.
     * @returns `true` if the node has the type `Comment`, `false` otherwise.
     */
    function isComment(node) {
        return node.type === require$$0$3.ElementType.Comment;
    }
    exports.isComment = isComment;
    /**
     * @param node Node to check.
     * @returns `true` if the node has the type `ProcessingInstruction`, `false` otherwise.
     */
    function isDirective(node) {
        return node.type === require$$0$3.ElementType.Directive;
    }
    exports.isDirective = isDirective;
    /**
     * @param node Node to check.
     * @returns `true` if the node has the type `ProcessingInstruction`, `false` otherwise.
     */
    function isDocument(node) {
        return node.type === require$$0$3.ElementType.Root;
    }
    exports.isDocument = isDocument;
    /**
     * @param node Node to check.
     * @returns `true` if the node has children, `false` otherwise.
     */
    function hasChildren(node) {
        return Object.prototype.hasOwnProperty.call(node, "children");
    }
    exports.hasChildren = hasChildren;
    /**
     * Clone a node, and optionally its children.
     *
     * @param recursive Clone child nodes as well.
     * @returns A clone of the node.
     */
    function cloneNode(node, recursive) {
        if (recursive === void 0) { recursive = false; }
        var result;
        if (isText(node)) {
            result = new Text(node.data);
        }
        else if (isComment(node)) {
            result = new Comment(node.data);
        }
        else if (isTag(node)) {
            var children = recursive ? cloneChildren(node.children) : [];
            var clone_1 = new Element(node.name, __assign({}, node.attribs), children);
            children.forEach(function (child) { return (child.parent = clone_1); });
            if (node.namespace != null) {
                clone_1.namespace = node.namespace;
            }
            if (node["x-attribsNamespace"]) {
                clone_1["x-attribsNamespace"] = __assign({}, node["x-attribsNamespace"]);
            }
            if (node["x-attribsPrefix"]) {
                clone_1["x-attribsPrefix"] = __assign({}, node["x-attribsPrefix"]);
            }
            result = clone_1;
        }
        else if (isCDATA(node)) {
            var children = recursive ? cloneChildren(node.children) : [];
            var clone_2 = new CDATA(children);
            children.forEach(function (child) { return (child.parent = clone_2); });
            result = clone_2;
        }
        else if (isDocument(node)) {
            var children = recursive ? cloneChildren(node.children) : [];
            var clone_3 = new Document(children);
            children.forEach(function (child) { return (child.parent = clone_3); });
            if (node["x-mode"]) {
                clone_3["x-mode"] = node["x-mode"];
            }
            result = clone_3;
        }
        else if (isDirective(node)) {
            var instruction = new ProcessingInstruction(node.name, node.data);
            if (node["x-name"] != null) {
                instruction["x-name"] = node["x-name"];
                instruction["x-publicId"] = node["x-publicId"];
                instruction["x-systemId"] = node["x-systemId"];
            }
            result = instruction;
        }
        else {
            throw new Error("Not implemented yet: ".concat(node.type));
        }
        result.startIndex = node.startIndex;
        result.endIndex = node.endIndex;
        if (node.sourceCodeLocation != null) {
            result.sourceCodeLocation = node.sourceCodeLocation;
        }
        return result;
    }
    exports.cloneNode = cloneNode;
    function cloneChildren(childs) {
        var children = childs.map(function (child) { return cloneNode(child, true); });
        for (var i = 1; i < children.length; i++) {
            children[i].prev = children[i - 1];
            children[i - 1].next = children[i];
        }
        return children;
    }
    });

    var node_js_1 = node;

    var lib$4 = createCommonjsModule(function (module, exports) {
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DomHandler = void 0;


    __exportStar(node_js_1, exports);
    // Default options
    var defaultOpts = {
        withStartIndices: false,
        withEndIndices: false,
        xmlMode: false,
    };
    var DomHandler = /** @class */ (function () {
        /**
         * @param callback Called once parsing has completed.
         * @param options Settings for the handler.
         * @param elementCB Callback whenever a tag is closed.
         */
        function DomHandler(callback, options, elementCB) {
            /** The elements of the DOM */
            this.dom = [];
            /** The root element for the DOM */
            this.root = new node_js_1.Document(this.dom);
            /** Indicated whether parsing has been completed. */
            this.done = false;
            /** Stack of open tags. */
            this.tagStack = [this.root];
            /** A data node that is still being written to. */
            this.lastNode = null;
            /** Reference to the parser instance. Used for location information. */
            this.parser = null;
            // Make it possible to skip arguments, for backwards-compatibility
            if (typeof options === "function") {
                elementCB = options;
                options = defaultOpts;
            }
            if (typeof callback === "object") {
                options = callback;
                callback = undefined;
            }
            this.callback = callback !== null && callback !== void 0 ? callback : null;
            this.options = options !== null && options !== void 0 ? options : defaultOpts;
            this.elementCB = elementCB !== null && elementCB !== void 0 ? elementCB : null;
        }
        DomHandler.prototype.onparserinit = function (parser) {
            this.parser = parser;
        };
        // Resets the handler back to starting state
        DomHandler.prototype.onreset = function () {
            this.dom = [];
            this.root = new node_js_1.Document(this.dom);
            this.done = false;
            this.tagStack = [this.root];
            this.lastNode = null;
            this.parser = null;
        };
        // Signals the handler that parsing is done
        DomHandler.prototype.onend = function () {
            if (this.done)
                return;
            this.done = true;
            this.parser = null;
            this.handleCallback(null);
        };
        DomHandler.prototype.onerror = function (error) {
            this.handleCallback(error);
        };
        DomHandler.prototype.onclosetag = function () {
            this.lastNode = null;
            var elem = this.tagStack.pop();
            if (this.options.withEndIndices) {
                elem.endIndex = this.parser.endIndex;
            }
            if (this.elementCB)
                this.elementCB(elem);
        };
        DomHandler.prototype.onopentag = function (name, attribs) {
            var type = this.options.xmlMode ? require$$0$3.ElementType.Tag : undefined;
            var element = new node_js_1.Element(name, attribs, undefined, type);
            this.addNode(element);
            this.tagStack.push(element);
        };
        DomHandler.prototype.ontext = function (data) {
            var lastNode = this.lastNode;
            if (lastNode && lastNode.type === require$$0$3.ElementType.Text) {
                lastNode.data += data;
                if (this.options.withEndIndices) {
                    lastNode.endIndex = this.parser.endIndex;
                }
            }
            else {
                var node = new node_js_1.Text(data);
                this.addNode(node);
                this.lastNode = node;
            }
        };
        DomHandler.prototype.oncomment = function (data) {
            if (this.lastNode && this.lastNode.type === require$$0$3.ElementType.Comment) {
                this.lastNode.data += data;
                return;
            }
            var node = new node_js_1.Comment(data);
            this.addNode(node);
            this.lastNode = node;
        };
        DomHandler.prototype.oncommentend = function () {
            this.lastNode = null;
        };
        DomHandler.prototype.oncdatastart = function () {
            var text = new node_js_1.Text("");
            var node = new node_js_1.CDATA([text]);
            this.addNode(node);
            text.parent = node;
            this.lastNode = text;
        };
        DomHandler.prototype.oncdataend = function () {
            this.lastNode = null;
        };
        DomHandler.prototype.onprocessinginstruction = function (name, data) {
            var node = new node_js_1.ProcessingInstruction(name, data);
            this.addNode(node);
        };
        DomHandler.prototype.handleCallback = function (error) {
            if (typeof this.callback === "function") {
                this.callback(error, this.dom);
            }
            else if (error) {
                throw error;
            }
        };
        DomHandler.prototype.addNode = function (node) {
            var parent = this.tagStack[this.tagStack.length - 1];
            var previousSibling = parent.children[parent.children.length - 1];
            if (this.options.withStartIndices) {
                node.startIndex = this.parser.startIndex;
            }
            if (this.options.withEndIndices) {
                node.endIndex = this.parser.endIndex;
            }
            parent.children.push(node);
            if (previousSibling) {
                node.prev = previousSibling;
                previousSibling.next = node;
            }
            node.parent = parent;
            this.lastNode = null;
        };
        return DomHandler;
    }());
    exports.DomHandler = DomHandler;
    exports.default = DomHandler;
    });

    // Generated using scripts/write-encode-map.ts

    function restoreDiff(arr) {
        for (var i = 1; i < arr.length; i++) {
            arr[i][0] += arr[i - 1][0] + 1;
        }
        return arr;
    }
    // prettier-ignore
    var _default = new Map(/* #__PURE__ */ restoreDiff([[9, "&Tab;"], [0, "&NewLine;"], [22, "&excl;"], [0, "&quot;"], [0, "&num;"], [0, "&dollar;"], [0, "&percnt;"], [0, "&amp;"], [0, "&apos;"], [0, "&lpar;"], [0, "&rpar;"], [0, "&ast;"], [0, "&plus;"], [0, "&comma;"], [1, "&period;"], [0, "&sol;"], [10, "&colon;"], [0, "&semi;"], [0, { v: "&lt;", n: 8402, o: "&nvlt;" }], [0, { v: "&equals;", n: 8421, o: "&bne;" }], [0, { v: "&gt;", n: 8402, o: "&nvgt;" }], [0, "&quest;"], [0, "&commat;"], [26, "&lbrack;"], [0, "&bsol;"], [0, "&rbrack;"], [0, "&Hat;"], [0, "&lowbar;"], [0, "&DiacriticalGrave;"], [5, { n: 106, o: "&fjlig;" }], [20, "&lbrace;"], [0, "&verbar;"], [0, "&rbrace;"], [34, "&nbsp;"], [0, "&iexcl;"], [0, "&cent;"], [0, "&pound;"], [0, "&curren;"], [0, "&yen;"], [0, "&brvbar;"], [0, "&sect;"], [0, "&die;"], [0, "&copy;"], [0, "&ordf;"], [0, "&laquo;"], [0, "&not;"], [0, "&shy;"], [0, "&circledR;"], [0, "&macr;"], [0, "&deg;"], [0, "&PlusMinus;"], [0, "&sup2;"], [0, "&sup3;"], [0, "&acute;"], [0, "&micro;"], [0, "&para;"], [0, "&centerdot;"], [0, "&cedil;"], [0, "&sup1;"], [0, "&ordm;"], [0, "&raquo;"], [0, "&frac14;"], [0, "&frac12;"], [0, "&frac34;"], [0, "&iquest;"], [0, "&Agrave;"], [0, "&Aacute;"], [0, "&Acirc;"], [0, "&Atilde;"], [0, "&Auml;"], [0, "&angst;"], [0, "&AElig;"], [0, "&Ccedil;"], [0, "&Egrave;"], [0, "&Eacute;"], [0, "&Ecirc;"], [0, "&Euml;"], [0, "&Igrave;"], [0, "&Iacute;"], [0, "&Icirc;"], [0, "&Iuml;"], [0, "&ETH;"], [0, "&Ntilde;"], [0, "&Ograve;"], [0, "&Oacute;"], [0, "&Ocirc;"], [0, "&Otilde;"], [0, "&Ouml;"], [0, "&times;"], [0, "&Oslash;"], [0, "&Ugrave;"], [0, "&Uacute;"], [0, "&Ucirc;"], [0, "&Uuml;"], [0, "&Yacute;"], [0, "&THORN;"], [0, "&szlig;"], [0, "&agrave;"], [0, "&aacute;"], [0, "&acirc;"], [0, "&atilde;"], [0, "&auml;"], [0, "&aring;"], [0, "&aelig;"], [0, "&ccedil;"], [0, "&egrave;"], [0, "&eacute;"], [0, "&ecirc;"], [0, "&euml;"], [0, "&igrave;"], [0, "&iacute;"], [0, "&icirc;"], [0, "&iuml;"], [0, "&eth;"], [0, "&ntilde;"], [0, "&ograve;"], [0, "&oacute;"], [0, "&ocirc;"], [0, "&otilde;"], [0, "&ouml;"], [0, "&div;"], [0, "&oslash;"], [0, "&ugrave;"], [0, "&uacute;"], [0, "&ucirc;"], [0, "&uuml;"], [0, "&yacute;"], [0, "&thorn;"], [0, "&yuml;"], [0, "&Amacr;"], [0, "&amacr;"], [0, "&Abreve;"], [0, "&abreve;"], [0, "&Aogon;"], [0, "&aogon;"], [0, "&Cacute;"], [0, "&cacute;"], [0, "&Ccirc;"], [0, "&ccirc;"], [0, "&Cdot;"], [0, "&cdot;"], [0, "&Ccaron;"], [0, "&ccaron;"], [0, "&Dcaron;"], [0, "&dcaron;"], [0, "&Dstrok;"], [0, "&dstrok;"], [0, "&Emacr;"], [0, "&emacr;"], [2, "&Edot;"], [0, "&edot;"], [0, "&Eogon;"], [0, "&eogon;"], [0, "&Ecaron;"], [0, "&ecaron;"], [0, "&Gcirc;"], [0, "&gcirc;"], [0, "&Gbreve;"], [0, "&gbreve;"], [0, "&Gdot;"], [0, "&gdot;"], [0, "&Gcedil;"], [1, "&Hcirc;"], [0, "&hcirc;"], [0, "&Hstrok;"], [0, "&hstrok;"], [0, "&Itilde;"], [0, "&itilde;"], [0, "&Imacr;"], [0, "&imacr;"], [2, "&Iogon;"], [0, "&iogon;"], [0, "&Idot;"], [0, "&imath;"], [0, "&IJlig;"], [0, "&ijlig;"], [0, "&Jcirc;"], [0, "&jcirc;"], [0, "&Kcedil;"], [0, "&kcedil;"], [0, "&kgreen;"], [0, "&Lacute;"], [0, "&lacute;"], [0, "&Lcedil;"], [0, "&lcedil;"], [0, "&Lcaron;"], [0, "&lcaron;"], [0, "&Lmidot;"], [0, "&lmidot;"], [0, "&Lstrok;"], [0, "&lstrok;"], [0, "&Nacute;"], [0, "&nacute;"], [0, "&Ncedil;"], [0, "&ncedil;"], [0, "&Ncaron;"], [0, "&ncaron;"], [0, "&napos;"], [0, "&ENG;"], [0, "&eng;"], [0, "&Omacr;"], [0, "&omacr;"], [2, "&Odblac;"], [0, "&odblac;"], [0, "&OElig;"], [0, "&oelig;"], [0, "&Racute;"], [0, "&racute;"], [0, "&Rcedil;"], [0, "&rcedil;"], [0, "&Rcaron;"], [0, "&rcaron;"], [0, "&Sacute;"], [0, "&sacute;"], [0, "&Scirc;"], [0, "&scirc;"], [0, "&Scedil;"], [0, "&scedil;"], [0, "&Scaron;"], [0, "&scaron;"], [0, "&Tcedil;"], [0, "&tcedil;"], [0, "&Tcaron;"], [0, "&tcaron;"], [0, "&Tstrok;"], [0, "&tstrok;"], [0, "&Utilde;"], [0, "&utilde;"], [0, "&Umacr;"], [0, "&umacr;"], [0, "&Ubreve;"], [0, "&ubreve;"], [0, "&Uring;"], [0, "&uring;"], [0, "&Udblac;"], [0, "&udblac;"], [0, "&Uogon;"], [0, "&uogon;"], [0, "&Wcirc;"], [0, "&wcirc;"], [0, "&Ycirc;"], [0, "&ycirc;"], [0, "&Yuml;"], [0, "&Zacute;"], [0, "&zacute;"], [0, "&Zdot;"], [0, "&zdot;"], [0, "&Zcaron;"], [0, "&zcaron;"], [19, "&fnof;"], [34, "&imped;"], [63, "&gacute;"], [65, "&jmath;"], [142, "&circ;"], [0, "&caron;"], [16, "&breve;"], [0, "&DiacriticalDot;"], [0, "&ring;"], [0, "&ogon;"], [0, "&DiacriticalTilde;"], [0, "&dblac;"], [51, "&DownBreve;"], [127, "&Alpha;"], [0, "&Beta;"], [0, "&Gamma;"], [0, "&Delta;"], [0, "&Epsilon;"], [0, "&Zeta;"], [0, "&Eta;"], [0, "&Theta;"], [0, "&Iota;"], [0, "&Kappa;"], [0, "&Lambda;"], [0, "&Mu;"], [0, "&Nu;"], [0, "&Xi;"], [0, "&Omicron;"], [0, "&Pi;"], [0, "&Rho;"], [1, "&Sigma;"], [0, "&Tau;"], [0, "&Upsilon;"], [0, "&Phi;"], [0, "&Chi;"], [0, "&Psi;"], [0, "&ohm;"], [7, "&alpha;"], [0, "&beta;"], [0, "&gamma;"], [0, "&delta;"], [0, "&epsi;"], [0, "&zeta;"], [0, "&eta;"], [0, "&theta;"], [0, "&iota;"], [0, "&kappa;"], [0, "&lambda;"], [0, "&mu;"], [0, "&nu;"], [0, "&xi;"], [0, "&omicron;"], [0, "&pi;"], [0, "&rho;"], [0, "&sigmaf;"], [0, "&sigma;"], [0, "&tau;"], [0, "&upsi;"], [0, "&phi;"], [0, "&chi;"], [0, "&psi;"], [0, "&omega;"], [7, "&thetasym;"], [0, "&Upsi;"], [2, "&phiv;"], [0, "&piv;"], [5, "&Gammad;"], [0, "&digamma;"], [18, "&kappav;"], [0, "&rhov;"], [3, "&epsiv;"], [0, "&backepsilon;"], [10, "&IOcy;"], [0, "&DJcy;"], [0, "&GJcy;"], [0, "&Jukcy;"], [0, "&DScy;"], [0, "&Iukcy;"], [0, "&YIcy;"], [0, "&Jsercy;"], [0, "&LJcy;"], [0, "&NJcy;"], [0, "&TSHcy;"], [0, "&KJcy;"], [1, "&Ubrcy;"], [0, "&DZcy;"], [0, "&Acy;"], [0, "&Bcy;"], [0, "&Vcy;"], [0, "&Gcy;"], [0, "&Dcy;"], [0, "&IEcy;"], [0, "&ZHcy;"], [0, "&Zcy;"], [0, "&Icy;"], [0, "&Jcy;"], [0, "&Kcy;"], [0, "&Lcy;"], [0, "&Mcy;"], [0, "&Ncy;"], [0, "&Ocy;"], [0, "&Pcy;"], [0, "&Rcy;"], [0, "&Scy;"], [0, "&Tcy;"], [0, "&Ucy;"], [0, "&Fcy;"], [0, "&KHcy;"], [0, "&TScy;"], [0, "&CHcy;"], [0, "&SHcy;"], [0, "&SHCHcy;"], [0, "&HARDcy;"], [0, "&Ycy;"], [0, "&SOFTcy;"], [0, "&Ecy;"], [0, "&YUcy;"], [0, "&YAcy;"], [0, "&acy;"], [0, "&bcy;"], [0, "&vcy;"], [0, "&gcy;"], [0, "&dcy;"], [0, "&iecy;"], [0, "&zhcy;"], [0, "&zcy;"], [0, "&icy;"], [0, "&jcy;"], [0, "&kcy;"], [0, "&lcy;"], [0, "&mcy;"], [0, "&ncy;"], [0, "&ocy;"], [0, "&pcy;"], [0, "&rcy;"], [0, "&scy;"], [0, "&tcy;"], [0, "&ucy;"], [0, "&fcy;"], [0, "&khcy;"], [0, "&tscy;"], [0, "&chcy;"], [0, "&shcy;"], [0, "&shchcy;"], [0, "&hardcy;"], [0, "&ycy;"], [0, "&softcy;"], [0, "&ecy;"], [0, "&yucy;"], [0, "&yacy;"], [1, "&iocy;"], [0, "&djcy;"], [0, "&gjcy;"], [0, "&jukcy;"], [0, "&dscy;"], [0, "&iukcy;"], [0, "&yicy;"], [0, "&jsercy;"], [0, "&ljcy;"], [0, "&njcy;"], [0, "&tshcy;"], [0, "&kjcy;"], [1, "&ubrcy;"], [0, "&dzcy;"], [7074, "&ensp;"], [0, "&emsp;"], [0, "&emsp13;"], [0, "&emsp14;"], [1, "&numsp;"], [0, "&puncsp;"], [0, "&ThinSpace;"], [0, "&hairsp;"], [0, "&NegativeMediumSpace;"], [0, "&zwnj;"], [0, "&zwj;"], [0, "&lrm;"], [0, "&rlm;"], [0, "&dash;"], [2, "&ndash;"], [0, "&mdash;"], [0, "&horbar;"], [0, "&Verbar;"], [1, "&lsquo;"], [0, "&CloseCurlyQuote;"], [0, "&lsquor;"], [1, "&ldquo;"], [0, "&CloseCurlyDoubleQuote;"], [0, "&bdquo;"], [1, "&dagger;"], [0, "&Dagger;"], [0, "&bull;"], [2, "&nldr;"], [0, "&hellip;"], [9, "&permil;"], [0, "&pertenk;"], [0, "&prime;"], [0, "&Prime;"], [0, "&tprime;"], [0, "&backprime;"], [3, "&lsaquo;"], [0, "&rsaquo;"], [3, "&oline;"], [2, "&caret;"], [1, "&hybull;"], [0, "&frasl;"], [10, "&bsemi;"], [7, "&qprime;"], [7, { v: "&MediumSpace;", n: 8202, o: "&ThickSpace;" }], [0, "&NoBreak;"], [0, "&af;"], [0, "&InvisibleTimes;"], [0, "&ic;"], [72, "&euro;"], [46, "&tdot;"], [0, "&DotDot;"], [37, "&complexes;"], [2, "&incare;"], [4, "&gscr;"], [0, "&hamilt;"], [0, "&Hfr;"], [0, "&Hopf;"], [0, "&planckh;"], [0, "&hbar;"], [0, "&imagline;"], [0, "&Ifr;"], [0, "&lagran;"], [0, "&ell;"], [1, "&naturals;"], [0, "&numero;"], [0, "&copysr;"], [0, "&weierp;"], [0, "&Popf;"], [0, "&Qopf;"], [0, "&realine;"], [0, "&real;"], [0, "&reals;"], [0, "&rx;"], [3, "&trade;"], [1, "&integers;"], [2, "&mho;"], [0, "&zeetrf;"], [0, "&iiota;"], [2, "&bernou;"], [0, "&Cayleys;"], [1, "&escr;"], [0, "&Escr;"], [0, "&Fouriertrf;"], [1, "&Mellintrf;"], [0, "&order;"], [0, "&alefsym;"], [0, "&beth;"], [0, "&gimel;"], [0, "&daleth;"], [12, "&CapitalDifferentialD;"], [0, "&dd;"], [0, "&ee;"], [0, "&ii;"], [10, "&frac13;"], [0, "&frac23;"], [0, "&frac15;"], [0, "&frac25;"], [0, "&frac35;"], [0, "&frac45;"], [0, "&frac16;"], [0, "&frac56;"], [0, "&frac18;"], [0, "&frac38;"], [0, "&frac58;"], [0, "&frac78;"], [49, "&larr;"], [0, "&ShortUpArrow;"], [0, "&rarr;"], [0, "&darr;"], [0, "&harr;"], [0, "&updownarrow;"], [0, "&nwarr;"], [0, "&nearr;"], [0, "&LowerRightArrow;"], [0, "&LowerLeftArrow;"], [0, "&nlarr;"], [0, "&nrarr;"], [1, { v: "&rarrw;", n: 824, o: "&nrarrw;" }], [0, "&Larr;"], [0, "&Uarr;"], [0, "&Rarr;"], [0, "&Darr;"], [0, "&larrtl;"], [0, "&rarrtl;"], [0, "&LeftTeeArrow;"], [0, "&mapstoup;"], [0, "&map;"], [0, "&DownTeeArrow;"], [1, "&hookleftarrow;"], [0, "&hookrightarrow;"], [0, "&larrlp;"], [0, "&looparrowright;"], [0, "&harrw;"], [0, "&nharr;"], [1, "&lsh;"], [0, "&rsh;"], [0, "&ldsh;"], [0, "&rdsh;"], [1, "&crarr;"], [0, "&cularr;"], [0, "&curarr;"], [2, "&circlearrowleft;"], [0, "&circlearrowright;"], [0, "&leftharpoonup;"], [0, "&DownLeftVector;"], [0, "&RightUpVector;"], [0, "&LeftUpVector;"], [0, "&rharu;"], [0, "&DownRightVector;"], [0, "&dharr;"], [0, "&dharl;"], [0, "&RightArrowLeftArrow;"], [0, "&udarr;"], [0, "&LeftArrowRightArrow;"], [0, "&leftleftarrows;"], [0, "&upuparrows;"], [0, "&rightrightarrows;"], [0, "&ddarr;"], [0, "&leftrightharpoons;"], [0, "&Equilibrium;"], [0, "&nlArr;"], [0, "&nhArr;"], [0, "&nrArr;"], [0, "&DoubleLeftArrow;"], [0, "&DoubleUpArrow;"], [0, "&DoubleRightArrow;"], [0, "&dArr;"], [0, "&DoubleLeftRightArrow;"], [0, "&DoubleUpDownArrow;"], [0, "&nwArr;"], [0, "&neArr;"], [0, "&seArr;"], [0, "&swArr;"], [0, "&lAarr;"], [0, "&rAarr;"], [1, "&zigrarr;"], [6, "&larrb;"], [0, "&rarrb;"], [15, "&DownArrowUpArrow;"], [7, "&loarr;"], [0, "&roarr;"], [0, "&hoarr;"], [0, "&forall;"], [0, "&comp;"], [0, { v: "&part;", n: 824, o: "&npart;" }], [0, "&exist;"], [0, "&nexist;"], [0, "&empty;"], [1, "&Del;"], [0, "&Element;"], [0, "&NotElement;"], [1, "&ni;"], [0, "&notni;"], [2, "&prod;"], [0, "&coprod;"], [0, "&sum;"], [0, "&minus;"], [0, "&MinusPlus;"], [0, "&dotplus;"], [1, "&Backslash;"], [0, "&lowast;"], [0, "&compfn;"], [1, "&radic;"], [2, "&prop;"], [0, "&infin;"], [0, "&angrt;"], [0, { v: "&ang;", n: 8402, o: "&nang;" }], [0, "&angmsd;"], [0, "&angsph;"], [0, "&mid;"], [0, "&nmid;"], [0, "&DoubleVerticalBar;"], [0, "&NotDoubleVerticalBar;"], [0, "&and;"], [0, "&or;"], [0, { v: "&cap;", n: 65024, o: "&caps;" }], [0, { v: "&cup;", n: 65024, o: "&cups;" }], [0, "&int;"], [0, "&Int;"], [0, "&iiint;"], [0, "&conint;"], [0, "&Conint;"], [0, "&Cconint;"], [0, "&cwint;"], [0, "&ClockwiseContourIntegral;"], [0, "&awconint;"], [0, "&there4;"], [0, "&becaus;"], [0, "&ratio;"], [0, "&Colon;"], [0, "&dotminus;"], [1, "&mDDot;"], [0, "&homtht;"], [0, { v: "&sim;", n: 8402, o: "&nvsim;" }], [0, { v: "&backsim;", n: 817, o: "&race;" }], [0, { v: "&ac;", n: 819, o: "&acE;" }], [0, "&acd;"], [0, "&VerticalTilde;"], [0, "&NotTilde;"], [0, { v: "&eqsim;", n: 824, o: "&nesim;" }], [0, "&sime;"], [0, "&NotTildeEqual;"], [0, "&cong;"], [0, "&simne;"], [0, "&ncong;"], [0, "&ap;"], [0, "&nap;"], [0, "&ape;"], [0, { v: "&apid;", n: 824, o: "&napid;" }], [0, "&backcong;"], [0, { v: "&asympeq;", n: 8402, o: "&nvap;" }], [0, { v: "&bump;", n: 824, o: "&nbump;" }], [0, { v: "&bumpe;", n: 824, o: "&nbumpe;" }], [0, { v: "&doteq;", n: 824, o: "&nedot;" }], [0, "&doteqdot;"], [0, "&efDot;"], [0, "&erDot;"], [0, "&Assign;"], [0, "&ecolon;"], [0, "&ecir;"], [0, "&circeq;"], [1, "&wedgeq;"], [0, "&veeeq;"], [1, "&triangleq;"], [2, "&equest;"], [0, "&ne;"], [0, { v: "&Congruent;", n: 8421, o: "&bnequiv;" }], [0, "&nequiv;"], [1, { v: "&le;", n: 8402, o: "&nvle;" }], [0, { v: "&ge;", n: 8402, o: "&nvge;" }], [0, { v: "&lE;", n: 824, o: "&nlE;" }], [0, { v: "&gE;", n: 824, o: "&ngE;" }], [0, { v: "&lnE;", n: 65024, o: "&lvertneqq;" }], [0, { v: "&gnE;", n: 65024, o: "&gvertneqq;" }], [0, { v: "&ll;", n: new Map(/* #__PURE__ */ restoreDiff([[824, "&nLtv;"], [7577, "&nLt;"]])) }], [0, { v: "&gg;", n: new Map(/* #__PURE__ */ restoreDiff([[824, "&nGtv;"], [7577, "&nGt;"]])) }], [0, "&between;"], [0, "&NotCupCap;"], [0, "&nless;"], [0, "&ngt;"], [0, "&nle;"], [0, "&nge;"], [0, "&lesssim;"], [0, "&GreaterTilde;"], [0, "&nlsim;"], [0, "&ngsim;"], [0, "&LessGreater;"], [0, "&gl;"], [0, "&NotLessGreater;"], [0, "&NotGreaterLess;"], [0, "&pr;"], [0, "&sc;"], [0, "&prcue;"], [0, "&sccue;"], [0, "&PrecedesTilde;"], [0, { v: "&scsim;", n: 824, o: "&NotSucceedsTilde;" }], [0, "&NotPrecedes;"], [0, "&NotSucceeds;"], [0, { v: "&sub;", n: 8402, o: "&NotSubset;" }], [0, { v: "&sup;", n: 8402, o: "&NotSuperset;" }], [0, "&nsub;"], [0, "&nsup;"], [0, "&sube;"], [0, "&supe;"], [0, "&NotSubsetEqual;"], [0, "&NotSupersetEqual;"], [0, { v: "&subne;", n: 65024, o: "&varsubsetneq;" }], [0, { v: "&supne;", n: 65024, o: "&varsupsetneq;" }], [1, "&cupdot;"], [0, "&UnionPlus;"], [0, { v: "&sqsub;", n: 824, o: "&NotSquareSubset;" }], [0, { v: "&sqsup;", n: 824, o: "&NotSquareSuperset;" }], [0, "&sqsube;"], [0, "&sqsupe;"], [0, { v: "&sqcap;", n: 65024, o: "&sqcaps;" }], [0, { v: "&sqcup;", n: 65024, o: "&sqcups;" }], [0, "&CirclePlus;"], [0, "&CircleMinus;"], [0, "&CircleTimes;"], [0, "&osol;"], [0, "&CircleDot;"], [0, "&circledcirc;"], [0, "&circledast;"], [1, "&circleddash;"], [0, "&boxplus;"], [0, "&boxminus;"], [0, "&boxtimes;"], [0, "&dotsquare;"], [0, "&RightTee;"], [0, "&dashv;"], [0, "&DownTee;"], [0, "&bot;"], [1, "&models;"], [0, "&DoubleRightTee;"], [0, "&Vdash;"], [0, "&Vvdash;"], [0, "&VDash;"], [0, "&nvdash;"], [0, "&nvDash;"], [0, "&nVdash;"], [0, "&nVDash;"], [0, "&prurel;"], [1, "&LeftTriangle;"], [0, "&RightTriangle;"], [0, { v: "&LeftTriangleEqual;", n: 8402, o: "&nvltrie;" }], [0, { v: "&RightTriangleEqual;", n: 8402, o: "&nvrtrie;" }], [0, "&origof;"], [0, "&imof;"], [0, "&multimap;"], [0, "&hercon;"], [0, "&intcal;"], [0, "&veebar;"], [1, "&barvee;"], [0, "&angrtvb;"], [0, "&lrtri;"], [0, "&bigwedge;"], [0, "&bigvee;"], [0, "&bigcap;"], [0, "&bigcup;"], [0, "&diam;"], [0, "&sdot;"], [0, "&sstarf;"], [0, "&divideontimes;"], [0, "&bowtie;"], [0, "&ltimes;"], [0, "&rtimes;"], [0, "&leftthreetimes;"], [0, "&rightthreetimes;"], [0, "&backsimeq;"], [0, "&curlyvee;"], [0, "&curlywedge;"], [0, "&Sub;"], [0, "&Sup;"], [0, "&Cap;"], [0, "&Cup;"], [0, "&fork;"], [0, "&epar;"], [0, "&lessdot;"], [0, "&gtdot;"], [0, { v: "&Ll;", n: 824, o: "&nLl;" }], [0, { v: "&Gg;", n: 824, o: "&nGg;" }], [0, { v: "&leg;", n: 65024, o: "&lesg;" }], [0, { v: "&gel;", n: 65024, o: "&gesl;" }], [2, "&cuepr;"], [0, "&cuesc;"], [0, "&NotPrecedesSlantEqual;"], [0, "&NotSucceedsSlantEqual;"], [0, "&NotSquareSubsetEqual;"], [0, "&NotSquareSupersetEqual;"], [2, "&lnsim;"], [0, "&gnsim;"], [0, "&precnsim;"], [0, "&scnsim;"], [0, "&nltri;"], [0, "&NotRightTriangle;"], [0, "&nltrie;"], [0, "&NotRightTriangleEqual;"], [0, "&vellip;"], [0, "&ctdot;"], [0, "&utdot;"], [0, "&dtdot;"], [0, "&disin;"], [0, "&isinsv;"], [0, "&isins;"], [0, { v: "&isindot;", n: 824, o: "&notindot;" }], [0, "&notinvc;"], [0, "&notinvb;"], [1, { v: "&isinE;", n: 824, o: "&notinE;" }], [0, "&nisd;"], [0, "&xnis;"], [0, "&nis;"], [0, "&notnivc;"], [0, "&notnivb;"], [6, "&barwed;"], [0, "&Barwed;"], [1, "&lceil;"], [0, "&rceil;"], [0, "&LeftFloor;"], [0, "&rfloor;"], [0, "&drcrop;"], [0, "&dlcrop;"], [0, "&urcrop;"], [0, "&ulcrop;"], [0, "&bnot;"], [1, "&profline;"], [0, "&profsurf;"], [1, "&telrec;"], [0, "&target;"], [5, "&ulcorn;"], [0, "&urcorn;"], [0, "&dlcorn;"], [0, "&drcorn;"], [2, "&frown;"], [0, "&smile;"], [9, "&cylcty;"], [0, "&profalar;"], [7, "&topbot;"], [6, "&ovbar;"], [1, "&solbar;"], [60, "&angzarr;"], [51, "&lmoustache;"], [0, "&rmoustache;"], [2, "&OverBracket;"], [0, "&bbrk;"], [0, "&bbrktbrk;"], [37, "&OverParenthesis;"], [0, "&UnderParenthesis;"], [0, "&OverBrace;"], [0, "&UnderBrace;"], [2, "&trpezium;"], [4, "&elinters;"], [59, "&blank;"], [164, "&circledS;"], [55, "&boxh;"], [1, "&boxv;"], [9, "&boxdr;"], [3, "&boxdl;"], [3, "&boxur;"], [3, "&boxul;"], [3, "&boxvr;"], [7, "&boxvl;"], [7, "&boxhd;"], [7, "&boxhu;"], [7, "&boxvh;"], [19, "&boxH;"], [0, "&boxV;"], [0, "&boxdR;"], [0, "&boxDr;"], [0, "&boxDR;"], [0, "&boxdL;"], [0, "&boxDl;"], [0, "&boxDL;"], [0, "&boxuR;"], [0, "&boxUr;"], [0, "&boxUR;"], [0, "&boxuL;"], [0, "&boxUl;"], [0, "&boxUL;"], [0, "&boxvR;"], [0, "&boxVr;"], [0, "&boxVR;"], [0, "&boxvL;"], [0, "&boxVl;"], [0, "&boxVL;"], [0, "&boxHd;"], [0, "&boxhD;"], [0, "&boxHD;"], [0, "&boxHu;"], [0, "&boxhU;"], [0, "&boxHU;"], [0, "&boxvH;"], [0, "&boxVh;"], [0, "&boxVH;"], [19, "&uhblk;"], [3, "&lhblk;"], [3, "&block;"], [8, "&blk14;"], [0, "&blk12;"], [0, "&blk34;"], [13, "&square;"], [8, "&blacksquare;"], [0, "&EmptyVerySmallSquare;"], [1, "&rect;"], [0, "&marker;"], [2, "&fltns;"], [1, "&bigtriangleup;"], [0, "&blacktriangle;"], [0, "&triangle;"], [2, "&blacktriangleright;"], [0, "&rtri;"], [3, "&bigtriangledown;"], [0, "&blacktriangledown;"], [0, "&dtri;"], [2, "&blacktriangleleft;"], [0, "&ltri;"], [6, "&loz;"], [0, "&cir;"], [32, "&tridot;"], [2, "&bigcirc;"], [8, "&ultri;"], [0, "&urtri;"], [0, "&lltri;"], [0, "&EmptySmallSquare;"], [0, "&FilledSmallSquare;"], [8, "&bigstar;"], [0, "&star;"], [7, "&phone;"], [49, "&female;"], [1, "&male;"], [29, "&spades;"], [2, "&clubs;"], [1, "&hearts;"], [0, "&diamondsuit;"], [3, "&sung;"], [2, "&flat;"], [0, "&natural;"], [0, "&sharp;"], [163, "&check;"], [3, "&cross;"], [8, "&malt;"], [21, "&sext;"], [33, "&VerticalSeparator;"], [25, "&lbbrk;"], [0, "&rbbrk;"], [84, "&bsolhsub;"], [0, "&suphsol;"], [28, "&LeftDoubleBracket;"], [0, "&RightDoubleBracket;"], [0, "&lang;"], [0, "&rang;"], [0, "&Lang;"], [0, "&Rang;"], [0, "&loang;"], [0, "&roang;"], [7, "&longleftarrow;"], [0, "&longrightarrow;"], [0, "&longleftrightarrow;"], [0, "&DoubleLongLeftArrow;"], [0, "&DoubleLongRightArrow;"], [0, "&DoubleLongLeftRightArrow;"], [1, "&longmapsto;"], [2, "&dzigrarr;"], [258, "&nvlArr;"], [0, "&nvrArr;"], [0, "&nvHarr;"], [0, "&Map;"], [6, "&lbarr;"], [0, "&bkarow;"], [0, "&lBarr;"], [0, "&dbkarow;"], [0, "&drbkarow;"], [0, "&DDotrahd;"], [0, "&UpArrowBar;"], [0, "&DownArrowBar;"], [2, "&Rarrtl;"], [2, "&latail;"], [0, "&ratail;"], [0, "&lAtail;"], [0, "&rAtail;"], [0, "&larrfs;"], [0, "&rarrfs;"], [0, "&larrbfs;"], [0, "&rarrbfs;"], [2, "&nwarhk;"], [0, "&nearhk;"], [0, "&hksearow;"], [0, "&hkswarow;"], [0, "&nwnear;"], [0, "&nesear;"], [0, "&seswar;"], [0, "&swnwar;"], [8, { v: "&rarrc;", n: 824, o: "&nrarrc;" }], [1, "&cudarrr;"], [0, "&ldca;"], [0, "&rdca;"], [0, "&cudarrl;"], [0, "&larrpl;"], [2, "&curarrm;"], [0, "&cularrp;"], [7, "&rarrpl;"], [2, "&harrcir;"], [0, "&Uarrocir;"], [0, "&lurdshar;"], [0, "&ldrushar;"], [2, "&LeftRightVector;"], [0, "&RightUpDownVector;"], [0, "&DownLeftRightVector;"], [0, "&LeftUpDownVector;"], [0, "&LeftVectorBar;"], [0, "&RightVectorBar;"], [0, "&RightUpVectorBar;"], [0, "&RightDownVectorBar;"], [0, "&DownLeftVectorBar;"], [0, "&DownRightVectorBar;"], [0, "&LeftUpVectorBar;"], [0, "&LeftDownVectorBar;"], [0, "&LeftTeeVector;"], [0, "&RightTeeVector;"], [0, "&RightUpTeeVector;"], [0, "&RightDownTeeVector;"], [0, "&DownLeftTeeVector;"], [0, "&DownRightTeeVector;"], [0, "&LeftUpTeeVector;"], [0, "&LeftDownTeeVector;"], [0, "&lHar;"], [0, "&uHar;"], [0, "&rHar;"], [0, "&dHar;"], [0, "&luruhar;"], [0, "&ldrdhar;"], [0, "&ruluhar;"], [0, "&rdldhar;"], [0, "&lharul;"], [0, "&llhard;"], [0, "&rharul;"], [0, "&lrhard;"], [0, "&udhar;"], [0, "&duhar;"], [0, "&RoundImplies;"], [0, "&erarr;"], [0, "&simrarr;"], [0, "&larrsim;"], [0, "&rarrsim;"], [0, "&rarrap;"], [0, "&ltlarr;"], [1, "&gtrarr;"], [0, "&subrarr;"], [1, "&suplarr;"], [0, "&lfisht;"], [0, "&rfisht;"], [0, "&ufisht;"], [0, "&dfisht;"], [5, "&lopar;"], [0, "&ropar;"], [4, "&lbrke;"], [0, "&rbrke;"], [0, "&lbrkslu;"], [0, "&rbrksld;"], [0, "&lbrksld;"], [0, "&rbrkslu;"], [0, "&langd;"], [0, "&rangd;"], [0, "&lparlt;"], [0, "&rpargt;"], [0, "&gtlPar;"], [0, "&ltrPar;"], [3, "&vzigzag;"], [1, "&vangrt;"], [0, "&angrtvbd;"], [6, "&ange;"], [0, "&range;"], [0, "&dwangle;"], [0, "&uwangle;"], [0, "&angmsdaa;"], [0, "&angmsdab;"], [0, "&angmsdac;"], [0, "&angmsdad;"], [0, "&angmsdae;"], [0, "&angmsdaf;"], [0, "&angmsdag;"], [0, "&angmsdah;"], [0, "&bemptyv;"], [0, "&demptyv;"], [0, "&cemptyv;"], [0, "&raemptyv;"], [0, "&laemptyv;"], [0, "&ohbar;"], [0, "&omid;"], [0, "&opar;"], [1, "&operp;"], [1, "&olcross;"], [0, "&odsold;"], [1, "&olcir;"], [0, "&ofcir;"], [0, "&olt;"], [0, "&ogt;"], [0, "&cirscir;"], [0, "&cirE;"], [0, "&solb;"], [0, "&bsolb;"], [3, "&boxbox;"], [3, "&trisb;"], [0, "&rtriltri;"], [0, { v: "&LeftTriangleBar;", n: 824, o: "&NotLeftTriangleBar;" }], [0, { v: "&RightTriangleBar;", n: 824, o: "&NotRightTriangleBar;" }], [11, "&iinfin;"], [0, "&infintie;"], [0, "&nvinfin;"], [4, "&eparsl;"], [0, "&smeparsl;"], [0, "&eqvparsl;"], [5, "&blacklozenge;"], [8, "&RuleDelayed;"], [1, "&dsol;"], [9, "&bigodot;"], [0, "&bigoplus;"], [0, "&bigotimes;"], [1, "&biguplus;"], [1, "&bigsqcup;"], [5, "&iiiint;"], [0, "&fpartint;"], [2, "&cirfnint;"], [0, "&awint;"], [0, "&rppolint;"], [0, "&scpolint;"], [0, "&npolint;"], [0, "&pointint;"], [0, "&quatint;"], [0, "&intlarhk;"], [10, "&pluscir;"], [0, "&plusacir;"], [0, "&simplus;"], [0, "&plusdu;"], [0, "&plussim;"], [0, "&plustwo;"], [1, "&mcomma;"], [0, "&minusdu;"], [2, "&loplus;"], [0, "&roplus;"], [0, "&Cross;"], [0, "&timesd;"], [0, "&timesbar;"], [1, "&smashp;"], [0, "&lotimes;"], [0, "&rotimes;"], [0, "&otimesas;"], [0, "&Otimes;"], [0, "&odiv;"], [0, "&triplus;"], [0, "&triminus;"], [0, "&tritime;"], [0, "&intprod;"], [2, "&amalg;"], [0, "&capdot;"], [1, "&ncup;"], [0, "&ncap;"], [0, "&capand;"], [0, "&cupor;"], [0, "&cupcap;"], [0, "&capcup;"], [0, "&cupbrcap;"], [0, "&capbrcup;"], [0, "&cupcup;"], [0, "&capcap;"], [0, "&ccups;"], [0, "&ccaps;"], [2, "&ccupssm;"], [2, "&And;"], [0, "&Or;"], [0, "&andand;"], [0, "&oror;"], [0, "&orslope;"], [0, "&andslope;"], [1, "&andv;"], [0, "&orv;"], [0, "&andd;"], [0, "&ord;"], [1, "&wedbar;"], [6, "&sdote;"], [3, "&simdot;"], [2, { v: "&congdot;", n: 824, o: "&ncongdot;" }], [0, "&easter;"], [0, "&apacir;"], [0, { v: "&apE;", n: 824, o: "&napE;" }], [0, "&eplus;"], [0, "&pluse;"], [0, "&Esim;"], [0, "&Colone;"], [0, "&Equal;"], [1, "&ddotseq;"], [0, "&equivDD;"], [0, "&ltcir;"], [0, "&gtcir;"], [0, "&ltquest;"], [0, "&gtquest;"], [0, { v: "&leqslant;", n: 824, o: "&nleqslant;" }], [0, { v: "&geqslant;", n: 824, o: "&ngeqslant;" }], [0, "&lesdot;"], [0, "&gesdot;"], [0, "&lesdoto;"], [0, "&gesdoto;"], [0, "&lesdotor;"], [0, "&gesdotol;"], [0, "&lap;"], [0, "&gap;"], [0, "&lne;"], [0, "&gne;"], [0, "&lnap;"], [0, "&gnap;"], [0, "&lEg;"], [0, "&gEl;"], [0, "&lsime;"], [0, "&gsime;"], [0, "&lsimg;"], [0, "&gsiml;"], [0, "&lgE;"], [0, "&glE;"], [0, "&lesges;"], [0, "&gesles;"], [0, "&els;"], [0, "&egs;"], [0, "&elsdot;"], [0, "&egsdot;"], [0, "&el;"], [0, "&eg;"], [2, "&siml;"], [0, "&simg;"], [0, "&simlE;"], [0, "&simgE;"], [0, { v: "&LessLess;", n: 824, o: "&NotNestedLessLess;" }], [0, { v: "&GreaterGreater;", n: 824, o: "&NotNestedGreaterGreater;" }], [1, "&glj;"], [0, "&gla;"], [0, "&ltcc;"], [0, "&gtcc;"], [0, "&lescc;"], [0, "&gescc;"], [0, "&smt;"], [0, "&lat;"], [0, { v: "&smte;", n: 65024, o: "&smtes;" }], [0, { v: "&late;", n: 65024, o: "&lates;" }], [0, "&bumpE;"], [0, { v: "&PrecedesEqual;", n: 824, o: "&NotPrecedesEqual;" }], [0, { v: "&sce;", n: 824, o: "&NotSucceedsEqual;" }], [2, "&prE;"], [0, "&scE;"], [0, "&precneqq;"], [0, "&scnE;"], [0, "&prap;"], [0, "&scap;"], [0, "&precnapprox;"], [0, "&scnap;"], [0, "&Pr;"], [0, "&Sc;"], [0, "&subdot;"], [0, "&supdot;"], [0, "&subplus;"], [0, "&supplus;"], [0, "&submult;"], [0, "&supmult;"], [0, "&subedot;"], [0, "&supedot;"], [0, { v: "&subE;", n: 824, o: "&nsubE;" }], [0, { v: "&supE;", n: 824, o: "&nsupE;" }], [0, "&subsim;"], [0, "&supsim;"], [2, { v: "&subnE;", n: 65024, o: "&varsubsetneqq;" }], [0, { v: "&supnE;", n: 65024, o: "&varsupsetneqq;" }], [2, "&csub;"], [0, "&csup;"], [0, "&csube;"], [0, "&csupe;"], [0, "&subsup;"], [0, "&supsub;"], [0, "&subsub;"], [0, "&supsup;"], [0, "&suphsub;"], [0, "&supdsub;"], [0, "&forkv;"], [0, "&topfork;"], [0, "&mlcp;"], [8, "&Dashv;"], [1, "&Vdashl;"], [0, "&Barv;"], [0, "&vBar;"], [0, "&vBarv;"], [1, "&Vbar;"], [0, "&Not;"], [0, "&bNot;"], [0, "&rnmid;"], [0, "&cirmid;"], [0, "&midcir;"], [0, "&topcir;"], [0, "&nhpar;"], [0, "&parsim;"], [9, { v: "&parsl;", n: 8421, o: "&nparsl;" }], [44343, { n: new Map(/* #__PURE__ */ restoreDiff([[56476, "&Ascr;"], [1, "&Cscr;"], [0, "&Dscr;"], [2, "&Gscr;"], [2, "&Jscr;"], [0, "&Kscr;"], [2, "&Nscr;"], [0, "&Oscr;"], [0, "&Pscr;"], [0, "&Qscr;"], [1, "&Sscr;"], [0, "&Tscr;"], [0, "&Uscr;"], [0, "&Vscr;"], [0, "&Wscr;"], [0, "&Xscr;"], [0, "&Yscr;"], [0, "&Zscr;"], [0, "&ascr;"], [0, "&bscr;"], [0, "&cscr;"], [0, "&dscr;"], [1, "&fscr;"], [1, "&hscr;"], [0, "&iscr;"], [0, "&jscr;"], [0, "&kscr;"], [0, "&lscr;"], [0, "&mscr;"], [0, "&nscr;"], [1, "&pscr;"], [0, "&qscr;"], [0, "&rscr;"], [0, "&sscr;"], [0, "&tscr;"], [0, "&uscr;"], [0, "&vscr;"], [0, "&wscr;"], [0, "&xscr;"], [0, "&yscr;"], [0, "&zscr;"], [52, "&Afr;"], [0, "&Bfr;"], [1, "&Dfr;"], [0, "&Efr;"], [0, "&Ffr;"], [0, "&Gfr;"], [2, "&Jfr;"], [0, "&Kfr;"], [0, "&Lfr;"], [0, "&Mfr;"], [0, "&Nfr;"], [0, "&Ofr;"], [0, "&Pfr;"], [0, "&Qfr;"], [1, "&Sfr;"], [0, "&Tfr;"], [0, "&Ufr;"], [0, "&Vfr;"], [0, "&Wfr;"], [0, "&Xfr;"], [0, "&Yfr;"], [1, "&afr;"], [0, "&bfr;"], [0, "&cfr;"], [0, "&dfr;"], [0, "&efr;"], [0, "&ffr;"], [0, "&gfr;"], [0, "&hfr;"], [0, "&ifr;"], [0, "&jfr;"], [0, "&kfr;"], [0, "&lfr;"], [0, "&mfr;"], [0, "&nfr;"], [0, "&ofr;"], [0, "&pfr;"], [0, "&qfr;"], [0, "&rfr;"], [0, "&sfr;"], [0, "&tfr;"], [0, "&ufr;"], [0, "&vfr;"], [0, "&wfr;"], [0, "&xfr;"], [0, "&yfr;"], [0, "&zfr;"], [0, "&Aopf;"], [0, "&Bopf;"], [1, "&Dopf;"], [0, "&Eopf;"], [0, "&Fopf;"], [0, "&Gopf;"], [1, "&Iopf;"], [0, "&Jopf;"], [0, "&Kopf;"], [0, "&Lopf;"], [0, "&Mopf;"], [1, "&Oopf;"], [3, "&Sopf;"], [0, "&Topf;"], [0, "&Uopf;"], [0, "&Vopf;"], [0, "&Wopf;"], [0, "&Xopf;"], [0, "&Yopf;"], [1, "&aopf;"], [0, "&bopf;"], [0, "&copf;"], [0, "&dopf;"], [0, "&eopf;"], [0, "&fopf;"], [0, "&gopf;"], [0, "&hopf;"], [0, "&iopf;"], [0, "&jopf;"], [0, "&kopf;"], [0, "&lopf;"], [0, "&mopf;"], [0, "&nopf;"], [0, "&oopf;"], [0, "&popf;"], [0, "&qopf;"], [0, "&ropf;"], [0, "&sopf;"], [0, "&topf;"], [0, "&uopf;"], [0, "&vopf;"], [0, "&wopf;"], [0, "&xopf;"], [0, "&yopf;"], [0, "&zopf;"]])) }], [8906, "&fflig;"], [0, "&filig;"], [0, "&fllig;"], [0, "&ffilig;"], [0, "&ffllig;"]]));


    var encodeHtml = /*#__PURE__*/Object.defineProperty({
    	default: _default
    }, '__esModule', {value: true});

    var _escape = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.escapeText = exports.escapeAttribute = exports.escapeUTF8 = exports.escape = exports.encodeXML = exports.getCodePoint = exports.xmlReplacer = void 0;
    exports.xmlReplacer = /["&'<>$\x80-\uFFFF]/g;
    var xmlCodeMap = new Map([
        [34, "&quot;"],
        [38, "&amp;"],
        [39, "&apos;"],
        [60, "&lt;"],
        [62, "&gt;"],
    ]);
    // For compatibility with node < 4, we wrap `codePointAt`
    exports.getCodePoint = 
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    String.prototype.codePointAt != null
        ? function (str, index) { return str.codePointAt(index); }
        : // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
            function (c, index) {
                return (c.charCodeAt(index) & 0xfc00) === 0xd800
                    ? (c.charCodeAt(index) - 0xd800) * 0x400 +
                        c.charCodeAt(index + 1) -
                        0xdc00 +
                        0x10000
                    : c.charCodeAt(index);
            };
    /**
     * Encodes all non-ASCII characters, as well as characters not valid in XML
     * documents using XML entities.
     *
     * If a character has no equivalent entity, a
     * numeric hexadecimal reference (eg. `&#xfc;`) will be used.
     */
    function encodeXML(str) {
        var ret = "";
        var lastIdx = 0;
        var match;
        while ((match = exports.xmlReplacer.exec(str)) !== null) {
            var i = match.index;
            var char = str.charCodeAt(i);
            var next = xmlCodeMap.get(char);
            if (next !== undefined) {
                ret += str.substring(lastIdx, i) + next;
                lastIdx = i + 1;
            }
            else {
                ret += "".concat(str.substring(lastIdx, i), "&#x").concat((0, exports.getCodePoint)(str, i).toString(16), ";");
                // Increase by 1 if we have a surrogate pair
                lastIdx = exports.xmlReplacer.lastIndex += Number((char & 0xfc00) === 0xd800);
            }
        }
        return ret + str.substr(lastIdx);
    }
    exports.encodeXML = encodeXML;
    /**
     * Encodes all non-ASCII characters, as well as characters not valid in XML
     * documents using numeric hexadecimal reference (eg. `&#xfc;`).
     *
     * Have a look at `escapeUTF8` if you want a more concise output at the expense
     * of reduced transportability.
     *
     * @param data String to escape.
     */
    exports.escape = encodeXML;
    function getEscaper(regex, map) {
        return function escape(data) {
            var match;
            var lastIdx = 0;
            var result = "";
            while ((match = regex.exec(data))) {
                if (lastIdx !== match.index) {
                    result += data.substring(lastIdx, match.index);
                }
                // We know that this chararcter will be in the map.
                result += map.get(match[0].charCodeAt(0));
                // Every match will be of length 1
                lastIdx = match.index + 1;
            }
            return result + data.substring(lastIdx);
        };
    }
    /**
     * Encodes all characters not valid in XML documents using XML entities.
     *
     * Note that the output will be character-set dependent.
     *
     * @param data String to escape.
     */
    exports.escapeUTF8 = getEscaper(/[&<>'"]/g, xmlCodeMap);
    /**
     * Encodes all characters that have to be escaped in HTML attributes,
     * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
     *
     * @param data String to escape.
     */
    exports.escapeAttribute = getEscaper(/["&\u00A0]/g, new Map([
        [34, "&quot;"],
        [38, "&amp;"],
        [160, "&nbsp;"],
    ]));
    /**
     * Encodes all characters that have to be escaped in HTML text,
     * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
     *
     * @param data String to escape.
     */
    exports.escapeText = getEscaper(/[&<>\u00A0]/g, new Map([
        [38, "&amp;"],
        [60, "&lt;"],
        [62, "&gt;"],
        [160, "&nbsp;"],
    ]));

    });

    var require$$0$2 = encodeHtml;

    var escape_js_1 = _escape;

    var encode = createCommonjsModule(function (module, exports) {
    var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.encodeNonAsciiHTML = exports.encodeHTML = void 0;
    var encode_html_js_1 = __importDefault(require$$0$2);

    var htmlReplacer = /[\t\n!-,./:-@[-`\f{-}$\x80-\uFFFF]/g;
    /**
     * Encodes all characters in the input using HTML entities. This includes
     * characters that are valid ASCII characters in HTML documents, such as `#`.
     *
     * To get a more compact output, consider using the `encodeNonAsciiHTML`
     * function, which will only encode characters that are not valid in HTML
     * documents, as well as non-ASCII characters.
     *
     * If a character has no equivalent entity, a numeric hexadecimal reference
     * (eg. `&#xfc;`) will be used.
     */
    function encodeHTML(data) {
        return encodeHTMLTrieRe(htmlReplacer, data);
    }
    exports.encodeHTML = encodeHTML;
    /**
     * Encodes all non-ASCII characters, as well as characters not valid in HTML
     * documents using HTML entities. This function will not encode characters that
     * are valid in HTML documents, such as `#`.
     *
     * If a character has no equivalent entity, a numeric hexadecimal reference
     * (eg. `&#xfc;`) will be used.
     */
    function encodeNonAsciiHTML(data) {
        return encodeHTMLTrieRe(escape_js_1.xmlReplacer, data);
    }
    exports.encodeNonAsciiHTML = encodeNonAsciiHTML;
    function encodeHTMLTrieRe(regExp, str) {
        var ret = "";
        var lastIdx = 0;
        var match;
        while ((match = regExp.exec(str)) !== null) {
            var i = match.index;
            ret += str.substring(lastIdx, i);
            var char = str.charCodeAt(i);
            var next = encode_html_js_1.default.get(char);
            if (typeof next === "object") {
                // We are in a branch. Try to match the next char.
                if (i + 1 < str.length) {
                    var nextChar = str.charCodeAt(i + 1);
                    var value = typeof next.n === "number"
                        ? next.n === nextChar
                            ? next.o
                            : undefined
                        : next.n.get(nextChar);
                    if (value !== undefined) {
                        ret += value;
                        lastIdx = regExp.lastIndex += 1;
                        continue;
                    }
                }
                next = next.v;
            }
            // We might have a tree node without a value; skip and use a numeric entitiy.
            if (next !== undefined) {
                ret += next;
                lastIdx = i + 1;
            }
            else {
                var cp = (0, escape_js_1.getCodePoint)(str, i);
                ret += "&#x".concat(cp.toString(16), ";");
                // Increase by 1 if we have a surrogate pair
                lastIdx = regExp.lastIndex += Number(cp !== char);
            }
        }
        return ret + str.substr(lastIdx);
    }

    });

    var encode_js_1 = encode;

    var lib$3 = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.decodeXMLStrict = exports.decodeHTML5Strict = exports.decodeHTML4Strict = exports.decodeHTML5 = exports.decodeHTML4 = exports.decodeHTMLStrict = exports.decodeHTML = exports.decodeXML = exports.encodeHTML5 = exports.encodeHTML4 = exports.encodeNonAsciiHTML = exports.encodeHTML = exports.escapeText = exports.escapeAttribute = exports.escapeUTF8 = exports.escape = exports.encodeXML = exports.encode = exports.decodeStrict = exports.decode = exports.EncodingMode = exports.DecodingMode = exports.EntityLevel = void 0;



    /** The level of entities to support. */
    var EntityLevel;
    (function (EntityLevel) {
        /** Support only XML entities. */
        EntityLevel[EntityLevel["XML"] = 0] = "XML";
        /** Support HTML entities, which are a superset of XML entities. */
        EntityLevel[EntityLevel["HTML"] = 1] = "HTML";
    })(EntityLevel = exports.EntityLevel || (exports.EntityLevel = {}));
    /** Determines whether some entities are allowed to be written without a trailing `;`. */
    var DecodingMode;
    (function (DecodingMode) {
        /** Support legacy HTML entities. */
        DecodingMode[DecodingMode["Legacy"] = 0] = "Legacy";
        /** Do not support legacy HTML entities. */
        DecodingMode[DecodingMode["Strict"] = 1] = "Strict";
    })(DecodingMode = exports.DecodingMode || (exports.DecodingMode = {}));
    var EncodingMode;
    (function (EncodingMode) {
        /**
         * The output is UTF-8 encoded. Only characters that need escaping within
         * XML will be escaped.
         */
        EncodingMode[EncodingMode["UTF8"] = 0] = "UTF8";
        /**
         * The output consists only of ASCII characters. Characters that need
         * escaping within HTML, and characters that aren't ASCII characters will
         * be escaped.
         */
        EncodingMode[EncodingMode["ASCII"] = 1] = "ASCII";
        /**
         * Encode all characters that have an equivalent entity, as well as all
         * characters that are not ASCII characters.
         */
        EncodingMode[EncodingMode["Extensive"] = 2] = "Extensive";
        /**
         * Encode all characters that have to be escaped in HTML attributes,
         * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
         */
        EncodingMode[EncodingMode["Attribute"] = 3] = "Attribute";
        /**
         * Encode all characters that have to be escaped in HTML text,
         * following {@link https://html.spec.whatwg.org/multipage/parsing.html#escapingString}.
         */
        EncodingMode[EncodingMode["Text"] = 4] = "Text";
    })(EncodingMode = exports.EncodingMode || (exports.EncodingMode = {}));
    /**
     * Decodes a string with entities.
     *
     * @param data String to decode.
     * @param options Decoding options.
     */
    function decode(data, options) {
        if (options === void 0) { options = EntityLevel.XML; }
        var opts = typeof options === "number" ? { level: options } : options;
        if (opts.level === EntityLevel.HTML) {
            if (opts.mode === DecodingMode.Strict) {
                return (0, decode_js_1.decodeHTMLStrict)(data);
            }
            return (0, decode_js_1.decodeHTML)(data);
        }
        return (0, decode_js_1.decodeXML)(data);
    }
    exports.decode = decode;
    /**
     * Decodes a string with entities. Does not allow missing trailing semicolons for entities.
     *
     * @param data String to decode.
     * @param options Decoding options.
     * @deprecated Use `decode` with the `mode` set to `Strict`.
     */
    function decodeStrict(data, options) {
        if (options === void 0) { options = EntityLevel.XML; }
        var opts = typeof options === "number" ? { level: options } : options;
        if (opts.level === EntityLevel.HTML) {
            if (opts.mode === DecodingMode.Legacy) {
                return (0, decode_js_1.decodeHTML)(data);
            }
            return (0, decode_js_1.decodeHTMLStrict)(data);
        }
        return (0, decode_js_1.decodeXML)(data);
    }
    exports.decodeStrict = decodeStrict;
    /**
     * Encodes a string with entities.
     *
     * @param data String to encode.
     * @param options Encoding options.
     */
    function encode(data, options) {
        if (options === void 0) { options = EntityLevel.XML; }
        var opts = typeof options === "number" ? { level: options } : options;
        // Mode `UTF8` just escapes XML entities
        if (opts.mode === EncodingMode.UTF8)
            return (0, escape_js_1.escapeUTF8)(data);
        if (opts.mode === EncodingMode.Attribute)
            return (0, escape_js_1.escapeAttribute)(data);
        if (opts.mode === EncodingMode.Text)
            return (0, escape_js_1.escapeText)(data);
        if (opts.level === EntityLevel.HTML) {
            if (opts.mode === EncodingMode.ASCII) {
                return (0, encode_js_1.encodeNonAsciiHTML)(data);
            }
            return (0, encode_js_1.encodeHTML)(data);
        }
        // ASCII and Extensive are equivalent
        return (0, escape_js_1.encodeXML)(data);
    }
    exports.encode = encode;
    var escape_js_2 = escape_js_1;
    Object.defineProperty(exports, "encodeXML", { enumerable: true, get: function () { return escape_js_2.encodeXML; } });
    Object.defineProperty(exports, "escape", { enumerable: true, get: function () { return escape_js_2.escape; } });
    Object.defineProperty(exports, "escapeUTF8", { enumerable: true, get: function () { return escape_js_2.escapeUTF8; } });
    Object.defineProperty(exports, "escapeAttribute", { enumerable: true, get: function () { return escape_js_2.escapeAttribute; } });
    Object.defineProperty(exports, "escapeText", { enumerable: true, get: function () { return escape_js_2.escapeText; } });
    var encode_js_2 = encode_js_1;
    Object.defineProperty(exports, "encodeHTML", { enumerable: true, get: function () { return encode_js_2.encodeHTML; } });
    Object.defineProperty(exports, "encodeNonAsciiHTML", { enumerable: true, get: function () { return encode_js_2.encodeNonAsciiHTML; } });
    // Legacy aliases (deprecated)
    Object.defineProperty(exports, "encodeHTML4", { enumerable: true, get: function () { return encode_js_2.encodeHTML; } });
    Object.defineProperty(exports, "encodeHTML5", { enumerable: true, get: function () { return encode_js_2.encodeHTML; } });
    var decode_js_2 = decode_js_1;
    Object.defineProperty(exports, "decodeXML", { enumerable: true, get: function () { return decode_js_2.decodeXML; } });
    Object.defineProperty(exports, "decodeHTML", { enumerable: true, get: function () { return decode_js_2.decodeHTML; } });
    Object.defineProperty(exports, "decodeHTMLStrict", { enumerable: true, get: function () { return decode_js_2.decodeHTMLStrict; } });
    // Legacy aliases (deprecated)
    Object.defineProperty(exports, "decodeHTML4", { enumerable: true, get: function () { return decode_js_2.decodeHTML; } });
    Object.defineProperty(exports, "decodeHTML5", { enumerable: true, get: function () { return decode_js_2.decodeHTML; } });
    Object.defineProperty(exports, "decodeHTML4Strict", { enumerable: true, get: function () { return decode_js_2.decodeHTMLStrict; } });
    Object.defineProperty(exports, "decodeHTML5Strict", { enumerable: true, get: function () { return decode_js_2.decodeHTMLStrict; } });
    Object.defineProperty(exports, "decodeXMLStrict", { enumerable: true, get: function () { return decode_js_2.decodeXML; } });

    });

    var foreignNames = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.attributeNames = exports.elementNames = void 0;
    exports.elementNames = new Map([
        "altGlyph",
        "altGlyphDef",
        "altGlyphItem",
        "animateColor",
        "animateMotion",
        "animateTransform",
        "clipPath",
        "feBlend",
        "feColorMatrix",
        "feComponentTransfer",
        "feComposite",
        "feConvolveMatrix",
        "feDiffuseLighting",
        "feDisplacementMap",
        "feDistantLight",
        "feDropShadow",
        "feFlood",
        "feFuncA",
        "feFuncB",
        "feFuncG",
        "feFuncR",
        "feGaussianBlur",
        "feImage",
        "feMerge",
        "feMergeNode",
        "feMorphology",
        "feOffset",
        "fePointLight",
        "feSpecularLighting",
        "feSpotLight",
        "feTile",
        "feTurbulence",
        "foreignObject",
        "glyphRef",
        "linearGradient",
        "radialGradient",
        "textPath",
    ].map(function (val) { return [val.toLowerCase(), val]; }));
    exports.attributeNames = new Map([
        "definitionURL",
        "attributeName",
        "attributeType",
        "baseFrequency",
        "baseProfile",
        "calcMode",
        "clipPathUnits",
        "diffuseConstant",
        "edgeMode",
        "filterUnits",
        "glyphRef",
        "gradientTransform",
        "gradientUnits",
        "kernelMatrix",
        "kernelUnitLength",
        "keyPoints",
        "keySplines",
        "keyTimes",
        "lengthAdjust",
        "limitingConeAngle",
        "markerHeight",
        "markerUnits",
        "markerWidth",
        "maskContentUnits",
        "maskUnits",
        "numOctaves",
        "pathLength",
        "patternContentUnits",
        "patternTransform",
        "patternUnits",
        "pointsAtX",
        "pointsAtY",
        "pointsAtZ",
        "preserveAlpha",
        "preserveAspectRatio",
        "primitiveUnits",
        "refX",
        "refY",
        "repeatCount",
        "repeatDur",
        "requiredExtensions",
        "requiredFeatures",
        "specularConstant",
        "specularExponent",
        "spreadMethod",
        "startOffset",
        "stdDeviation",
        "stitchTiles",
        "surfaceScale",
        "systemLanguage",
        "tableValues",
        "targetX",
        "targetY",
        "textLength",
        "viewBox",
        "viewTarget",
        "xChannelSelector",
        "yChannelSelector",
        "zoomAndPan",
    ].map(function (val) { return [val.toLowerCase(), val]; }));
    });

    var entities_1 = lib$3;

    var foreignNames_js_1 = foreignNames;

    var lib$2 = createCommonjsModule(function (module, exports) {
    var __assign = (commonjsGlobal && commonjsGlobal.__assign) || function () {
        __assign = Object.assign || function(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    });
    var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.render = void 0;
    /*
     * Module dependencies
     */
    var ElementType = __importStar(require$$0$3);

    /**
     * Mixed-case SVG and MathML tags & attributes
     * recognized by the HTML parser.
     *
     * @see https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inforeign
     */

    var unencodedElements = new Set([
        "style",
        "script",
        "xmp",
        "iframe",
        "noembed",
        "noframes",
        "plaintext",
        "noscript",
    ]);
    function replaceQuotes(value) {
        return value.replace(/"/g, "&quot;");
    }
    /**
     * Format attributes
     */
    function formatAttributes(attributes, opts) {
        var _a;
        if (!attributes)
            return;
        var encode = ((_a = opts.encodeEntities) !== null && _a !== void 0 ? _a : opts.decodeEntities) === false
            ? replaceQuotes
            : opts.xmlMode || opts.encodeEntities !== "utf8"
                ? entities_1.encodeXML
                : entities_1.escapeAttribute;
        return Object.keys(attributes)
            .map(function (key) {
            var _a, _b;
            var value = (_a = attributes[key]) !== null && _a !== void 0 ? _a : "";
            if (opts.xmlMode === "foreign") {
                /* Fix up mixed-case attribute names */
                key = (_b = foreignNames_js_1.attributeNames.get(key)) !== null && _b !== void 0 ? _b : key;
            }
            if (!opts.emptyAttrs && !opts.xmlMode && value === "") {
                return key;
            }
            return "".concat(key, "=\"").concat(encode(value), "\"");
        })
            .join(" ");
    }
    /**
     * Self-enclosing tags
     */
    var singleTag = new Set([
        "area",
        "base",
        "basefont",
        "br",
        "col",
        "command",
        "embed",
        "frame",
        "hr",
        "img",
        "input",
        "isindex",
        "keygen",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    ]);
    /**
     * Renders a DOM node or an array of DOM nodes to a string.
     *
     * Can be thought of as the equivalent of the `outerHTML` of the passed node(s).
     *
     * @param node Node to be rendered.
     * @param options Changes serialization behavior
     */
    function render(node, options) {
        if (options === void 0) { options = {}; }
        var nodes = "length" in node ? node : [node];
        var output = "";
        for (var i = 0; i < nodes.length; i++) {
            output += renderNode(nodes[i], options);
        }
        return output;
    }
    exports.render = render;
    exports.default = render;
    function renderNode(node, options) {
        switch (node.type) {
            case ElementType.Root:
                return render(node.children, options);
            // @ts-expect-error We don't use `Doctype` yet
            case ElementType.Doctype:
            case ElementType.Directive:
                return renderDirective(node);
            case ElementType.Comment:
                return renderComment(node);
            case ElementType.CDATA:
                return renderCdata(node);
            case ElementType.Script:
            case ElementType.Style:
            case ElementType.Tag:
                return renderTag(node, options);
            case ElementType.Text:
                return renderText(node, options);
        }
    }
    var foreignModeIntegrationPoints = new Set([
        "mi",
        "mo",
        "mn",
        "ms",
        "mtext",
        "annotation-xml",
        "foreignObject",
        "desc",
        "title",
    ]);
    var foreignElements = new Set(["svg", "math"]);
    function renderTag(elem, opts) {
        var _a;
        // Handle SVG / MathML in HTML
        if (opts.xmlMode === "foreign") {
            /* Fix up mixed-case element names */
            elem.name = (_a = foreignNames_js_1.elementNames.get(elem.name)) !== null && _a !== void 0 ? _a : elem.name;
            /* Exit foreign mode at integration points */
            if (elem.parent &&
                foreignModeIntegrationPoints.has(elem.parent.name)) {
                opts = __assign(__assign({}, opts), { xmlMode: false });
            }
        }
        if (!opts.xmlMode && foreignElements.has(elem.name)) {
            opts = __assign(__assign({}, opts), { xmlMode: "foreign" });
        }
        var tag = "<".concat(elem.name);
        var attribs = formatAttributes(elem.attribs, opts);
        if (attribs) {
            tag += " ".concat(attribs);
        }
        if (elem.children.length === 0 &&
            (opts.xmlMode
                ? // In XML mode or foreign mode, and user hasn't explicitly turned off self-closing tags
                    opts.selfClosingTags !== false
                : // User explicitly asked for self-closing tags, even in HTML mode
                    opts.selfClosingTags && singleTag.has(elem.name))) {
            if (!opts.xmlMode)
                tag += " ";
            tag += "/>";
        }
        else {
            tag += ">";
            if (elem.children.length > 0) {
                tag += render(elem.children, opts);
            }
            if (opts.xmlMode || !singleTag.has(elem.name)) {
                tag += "</".concat(elem.name, ">");
            }
        }
        return tag;
    }
    function renderDirective(elem) {
        return "<".concat(elem.data, ">");
    }
    function renderText(elem, opts) {
        var _a;
        var data = elem.data || "";
        // If entities weren't decoded, no need to encode them back
        if (((_a = opts.encodeEntities) !== null && _a !== void 0 ? _a : opts.decodeEntities) !== false &&
            !(!opts.xmlMode &&
                elem.parent &&
                unencodedElements.has(elem.parent.name))) {
            data =
                opts.xmlMode || opts.encodeEntities !== "utf8"
                    ? (0, entities_1.encodeXML)(data)
                    : (0, entities_1.escapeText)(data);
        }
        return data;
    }
    function renderCdata(elem) {
        return "<![CDATA[".concat(elem.children[0].data, "]]>");
    }
    function renderComment(elem) {
        return "<!--".concat(elem.data, "-->");
    }
    });

    var domhandler_1 = lib$4;

    var require$$0$1 = lib$2;

    var stringify$1 = createCommonjsModule(function (module, exports) {
    var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.innerText = exports.textContent = exports.getText = exports.getInnerHTML = exports.getOuterHTML = void 0;

    var dom_serializer_1 = __importDefault(require$$0$1);

    /**
     * @category Stringify
     * @deprecated Use the `dom-serializer` module directly.
     * @param node Node to get the outer HTML of.
     * @param options Options for serialization.
     * @returns `node`'s outer HTML.
     */
    function getOuterHTML(node, options) {
        return (0, dom_serializer_1.default)(node, options);
    }
    exports.getOuterHTML = getOuterHTML;
    /**
     * @category Stringify
     * @deprecated Use the `dom-serializer` module directly.
     * @param node Node to get the inner HTML of.
     * @param options Options for serialization.
     * @returns `node`'s inner HTML.
     */
    function getInnerHTML(node, options) {
        return (0, domhandler_1.hasChildren)(node)
            ? node.children.map(function (node) { return getOuterHTML(node, options); }).join("")
            : "";
    }
    exports.getInnerHTML = getInnerHTML;
    /**
     * Get a node's inner text. Same as `textContent`, but inserts newlines for `<br>` tags.
     *
     * @category Stringify
     * @deprecated Use `textContent` instead.
     * @param node Node to get the inner text of.
     * @returns `node`'s inner text.
     */
    function getText(node) {
        if (Array.isArray(node))
            return node.map(getText).join("");
        if ((0, domhandler_1.isTag)(node))
            return node.name === "br" ? "\n" : getText(node.children);
        if ((0, domhandler_1.isCDATA)(node))
            return getText(node.children);
        if ((0, domhandler_1.isText)(node))
            return node.data;
        return "";
    }
    exports.getText = getText;
    /**
     * Get a node's text content.
     *
     * @category Stringify
     * @param node Node to get the text content of.
     * @returns `node`'s text content.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent}
     */
    function textContent(node) {
        if (Array.isArray(node))
            return node.map(textContent).join("");
        if ((0, domhandler_1.hasChildren)(node) && !(0, domhandler_1.isComment)(node)) {
            return textContent(node.children);
        }
        if ((0, domhandler_1.isText)(node))
            return node.data;
        return "";
    }
    exports.textContent = textContent;
    /**
     * Get a node's inner text.
     *
     * @category Stringify
     * @param node Node to get the inner text of.
     * @returns `node`'s inner text.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Node/innerText}
     */
    function innerText(node) {
        if (Array.isArray(node))
            return node.map(innerText).join("");
        if ((0, domhandler_1.hasChildren)(node) && (node.type === require$$0$3.ElementType.Tag || (0, domhandler_1.isCDATA)(node))) {
            return innerText(node.children);
        }
        if ((0, domhandler_1.isText)(node))
            return node.data;
        return "";
    }
    exports.innerText = innerText;

    });

    var traversal = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.prevElementSibling = exports.nextElementSibling = exports.getName = exports.hasAttrib = exports.getAttributeValue = exports.getSiblings = exports.getParent = exports.getChildren = void 0;

    /**
     * Get a node's children.
     *
     * @category Traversal
     * @param elem Node to get the children of.
     * @returns `elem`'s children, or an empty array.
     */
    function getChildren(elem) {
        return (0, domhandler_1.hasChildren)(elem) ? elem.children : [];
    }
    exports.getChildren = getChildren;
    /**
     * Get a node's parent.
     *
     * @category Traversal
     * @param elem Node to get the parent of.
     * @returns `elem`'s parent node.
     */
    function getParent(elem) {
        return elem.parent || null;
    }
    exports.getParent = getParent;
    /**
     * Gets an elements siblings, including the element itself.
     *
     * Attempts to get the children through the element's parent first. If we don't
     * have a parent (the element is a root node), we walk the element's `prev` &
     * `next` to get all remaining nodes.
     *
     * @category Traversal
     * @param elem Element to get the siblings of.
     * @returns `elem`'s siblings.
     */
    function getSiblings(elem) {
        var _a, _b;
        var parent = getParent(elem);
        if (parent != null)
            return getChildren(parent);
        var siblings = [elem];
        var prev = elem.prev, next = elem.next;
        while (prev != null) {
            siblings.unshift(prev);
            (_a = prev, prev = _a.prev);
        }
        while (next != null) {
            siblings.push(next);
            (_b = next, next = _b.next);
        }
        return siblings;
    }
    exports.getSiblings = getSiblings;
    /**
     * Gets an attribute from an element.
     *
     * @category Traversal
     * @param elem Element to check.
     * @param name Attribute name to retrieve.
     * @returns The element's attribute value, or `undefined`.
     */
    function getAttributeValue(elem, name) {
        var _a;
        return (_a = elem.attribs) === null || _a === void 0 ? void 0 : _a[name];
    }
    exports.getAttributeValue = getAttributeValue;
    /**
     * Checks whether an element has an attribute.
     *
     * @category Traversal
     * @param elem Element to check.
     * @param name Attribute name to look for.
     * @returns Returns whether `elem` has the attribute `name`.
     */
    function hasAttrib(elem, name) {
        return (elem.attribs != null &&
            Object.prototype.hasOwnProperty.call(elem.attribs, name) &&
            elem.attribs[name] != null);
    }
    exports.hasAttrib = hasAttrib;
    /**
     * Get the tag name of an element.
     *
     * @category Traversal
     * @param elem The element to get the name for.
     * @returns The tag name of `elem`.
     */
    function getName(elem) {
        return elem.name;
    }
    exports.getName = getName;
    /**
     * Returns the next element sibling of a node.
     *
     * @category Traversal
     * @param elem The element to get the next sibling of.
     * @returns `elem`'s next sibling that is a tag.
     */
    function nextElementSibling(elem) {
        var _a;
        var next = elem.next;
        while (next !== null && !(0, domhandler_1.isTag)(next))
            (_a = next, next = _a.next);
        return next;
    }
    exports.nextElementSibling = nextElementSibling;
    /**
     * Returns the previous element sibling of a node.
     *
     * @category Traversal
     * @param elem The element to get the previous sibling of.
     * @returns `elem`'s previous sibling that is a tag.
     */
    function prevElementSibling(elem) {
        var _a;
        var prev = elem.prev;
        while (prev !== null && !(0, domhandler_1.isTag)(prev))
            (_a = prev, prev = _a.prev);
        return prev;
    }
    exports.prevElementSibling = prevElementSibling;

    });

    var manipulation = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.prepend = exports.prependChild = exports.append = exports.appendChild = exports.replaceElement = exports.removeElement = void 0;
    /**
     * Remove an element from the dom
     *
     * @category Manipulation
     * @param elem The element to be removed
     */
    function removeElement(elem) {
        if (elem.prev)
            elem.prev.next = elem.next;
        if (elem.next)
            elem.next.prev = elem.prev;
        if (elem.parent) {
            var childs = elem.parent.children;
            childs.splice(childs.lastIndexOf(elem), 1);
        }
    }
    exports.removeElement = removeElement;
    /**
     * Replace an element in the dom
     *
     * @category Manipulation
     * @param elem The element to be replaced
     * @param replacement The element to be added
     */
    function replaceElement(elem, replacement) {
        var prev = (replacement.prev = elem.prev);
        if (prev) {
            prev.next = replacement;
        }
        var next = (replacement.next = elem.next);
        if (next) {
            next.prev = replacement;
        }
        var parent = (replacement.parent = elem.parent);
        if (parent) {
            var childs = parent.children;
            childs[childs.lastIndexOf(elem)] = replacement;
            elem.parent = null;
        }
    }
    exports.replaceElement = replaceElement;
    /**
     * Append a child to an element.
     *
     * @category Manipulation
     * @param elem The element to append to.
     * @param child The element to be added as a child.
     */
    function appendChild(elem, child) {
        removeElement(child);
        child.next = null;
        child.parent = elem;
        if (elem.children.push(child) > 1) {
            var sibling = elem.children[elem.children.length - 2];
            sibling.next = child;
            child.prev = sibling;
        }
        else {
            child.prev = null;
        }
    }
    exports.appendChild = appendChild;
    /**
     * Append an element after another.
     *
     * @category Manipulation
     * @param elem The element to append after.
     * @param next The element be added.
     */
    function append(elem, next) {
        removeElement(next);
        var parent = elem.parent;
        var currNext = elem.next;
        next.next = currNext;
        next.prev = elem;
        elem.next = next;
        next.parent = parent;
        if (currNext) {
            currNext.prev = next;
            if (parent) {
                var childs = parent.children;
                childs.splice(childs.lastIndexOf(currNext), 0, next);
            }
        }
        else if (parent) {
            parent.children.push(next);
        }
    }
    exports.append = append;
    /**
     * Prepend a child to an element.
     *
     * @category Manipulation
     * @param elem The element to prepend before.
     * @param child The element to be added as a child.
     */
    function prependChild(elem, child) {
        removeElement(child);
        child.parent = elem;
        child.prev = null;
        if (elem.children.unshift(child) !== 1) {
            var sibling = elem.children[1];
            sibling.prev = child;
            child.next = sibling;
        }
        else {
            child.next = null;
        }
    }
    exports.prependChild = prependChild;
    /**
     * Prepend an element before another.
     *
     * @category Manipulation
     * @param elem The element to prepend before.
     * @param prev The element be added.
     */
    function prepend(elem, prev) {
        removeElement(prev);
        var parent = elem.parent;
        if (parent) {
            var childs = parent.children;
            childs.splice(childs.indexOf(elem), 0, prev);
        }
        if (elem.prev) {
            elem.prev.next = prev;
        }
        prev.parent = parent;
        prev.prev = elem.prev;
        prev.next = elem;
        elem.prev = prev;
    }
    exports.prepend = prepend;

    });

    var querying = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.findAll = exports.existsOne = exports.findOne = exports.findOneChild = exports.find = exports.filter = void 0;

    /**
     * Search a node and its children for nodes passing a test function.
     *
     * @category Querying
     * @param test Function to test nodes on.
     * @param node Node to search. Will be included in the result set if it matches.
     * @param recurse Also consider child nodes.
     * @param limit Maximum number of nodes to return.
     * @returns All nodes passing `test`.
     */
    function filter(test, node, recurse, limit) {
        if (recurse === void 0) { recurse = true; }
        if (limit === void 0) { limit = Infinity; }
        if (!Array.isArray(node))
            node = [node];
        return find(test, node, recurse, limit);
    }
    exports.filter = filter;
    /**
     * Search an array of node and its children for nodes passing a test function.
     *
     * @category Querying
     * @param test Function to test nodes on.
     * @param nodes Array of nodes to search.
     * @param recurse Also consider child nodes.
     * @param limit Maximum number of nodes to return.
     * @returns All nodes passing `test`.
     */
    function find(test, nodes, recurse, limit) {
        var result = [];
        for (var _i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
            var elem = nodes_1[_i];
            if (test(elem)) {
                result.push(elem);
                if (--limit <= 0)
                    break;
            }
            if (recurse && (0, domhandler_1.hasChildren)(elem) && elem.children.length > 0) {
                var children = find(test, elem.children, recurse, limit);
                result.push.apply(result, children);
                limit -= children.length;
                if (limit <= 0)
                    break;
            }
        }
        return result;
    }
    exports.find = find;
    /**
     * Finds the first element inside of an array that matches a test function.
     *
     * @category Querying
     * @param test Function to test nodes on.
     * @param nodes Array of nodes to search.
     * @returns The first node in the array that passes `test`.
     * @deprecated Use `Array.prototype.find` directly.
     */
    function findOneChild(test, nodes) {
        return nodes.find(test);
    }
    exports.findOneChild = findOneChild;
    /**
     * Finds one element in a tree that passes a test.
     *
     * @category Querying
     * @param test Function to test nodes on.
     * @param nodes Array of nodes to search.
     * @param recurse Also consider child nodes.
     * @returns The first child node that passes `test`.
     */
    function findOne(test, nodes, recurse) {
        if (recurse === void 0) { recurse = true; }
        var elem = null;
        for (var i = 0; i < nodes.length && !elem; i++) {
            var checked = nodes[i];
            if (!(0, domhandler_1.isTag)(checked)) {
                continue;
            }
            else if (test(checked)) {
                elem = checked;
            }
            else if (recurse && checked.children.length > 0) {
                elem = findOne(test, checked.children, true);
            }
        }
        return elem;
    }
    exports.findOne = findOne;
    /**
     * @category Querying
     * @param test Function to test nodes on.
     * @param nodes Array of nodes to search.
     * @returns Whether a tree of nodes contains at least one node passing the test.
     */
    function existsOne(test, nodes) {
        return nodes.some(function (checked) {
            return (0, domhandler_1.isTag)(checked) &&
                (test(checked) ||
                    (checked.children.length > 0 &&
                        existsOne(test, checked.children)));
        });
    }
    exports.existsOne = existsOne;
    /**
     * Search and array of nodes and its children for elements passing a test function.
     *
     * Same as `find`, but limited to elements and with less options, leading to reduced complexity.
     *
     * @category Querying
     * @param test Function to test nodes on.
     * @param nodes Array of nodes to search.
     * @returns All nodes passing `test`.
     */
    function findAll(test, nodes) {
        var _a;
        var result = [];
        var stack = nodes.filter(domhandler_1.isTag);
        var elem;
        while ((elem = stack.shift())) {
            var children = (_a = elem.children) === null || _a === void 0 ? void 0 : _a.filter(domhandler_1.isTag);
            if (children && children.length > 0) {
                stack.unshift.apply(stack, children);
            }
            if (test(elem))
                result.push(elem);
        }
        return result;
    }
    exports.findAll = findAll;

    });

    var require$$3$1 = querying;

    var legacy = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getElementsByTagType = exports.getElementsByTagName = exports.getElementById = exports.getElements = exports.testElement = void 0;


    var Checks = {
        tag_name: function (name) {
            if (typeof name === "function") {
                return function (elem) { return (0, domhandler_1.isTag)(elem) && name(elem.name); };
            }
            else if (name === "*") {
                return domhandler_1.isTag;
            }
            return function (elem) { return (0, domhandler_1.isTag)(elem) && elem.name === name; };
        },
        tag_type: function (type) {
            if (typeof type === "function") {
                return function (elem) { return type(elem.type); };
            }
            return function (elem) { return elem.type === type; };
        },
        tag_contains: function (data) {
            if (typeof data === "function") {
                return function (elem) { return (0, domhandler_1.isText)(elem) && data(elem.data); };
            }
            return function (elem) { return (0, domhandler_1.isText)(elem) && elem.data === data; };
        },
    };
    /**
     * @param attrib Attribute to check.
     * @param value Attribute value to look for.
     * @returns A function to check whether the a node has an attribute with a
     *   particular value.
     */
    function getAttribCheck(attrib, value) {
        if (typeof value === "function") {
            return function (elem) { return (0, domhandler_1.isTag)(elem) && value(elem.attribs[attrib]); };
        }
        return function (elem) { return (0, domhandler_1.isTag)(elem) && elem.attribs[attrib] === value; };
    }
    /**
     * @param a First function to combine.
     * @param b Second function to combine.
     * @returns A function taking a node and returning `true` if either of the input
     *   functions returns `true` for the node.
     */
    function combineFuncs(a, b) {
        return function (elem) { return a(elem) || b(elem); };
    }
    /**
     * @param options An object describing nodes to look for.
     * @returns A function executing all checks in `options` and returning `true` if
     *   any of them match a node.
     */
    function compileTest(options) {
        var funcs = Object.keys(options).map(function (key) {
            var value = options[key];
            return Object.prototype.hasOwnProperty.call(Checks, key)
                ? Checks[key](value)
                : getAttribCheck(key, value);
        });
        return funcs.length === 0 ? null : funcs.reduce(combineFuncs);
    }
    /**
     * @category Legacy Query Functions
     * @param options An object describing nodes to look for.
     * @param node The element to test.
     * @returns Whether the element matches the description in `options`.
     */
    function testElement(options, node) {
        var test = compileTest(options);
        return test ? test(node) : true;
    }
    exports.testElement = testElement;
    /**
     * @category Legacy Query Functions
     * @param options An object describing nodes to look for.
     * @param nodes Nodes to search through.
     * @param recurse Also consider child nodes.
     * @param limit Maximum number of nodes to return.
     * @returns All nodes that match `options`.
     */
    function getElements(options, nodes, recurse, limit) {
        if (limit === void 0) { limit = Infinity; }
        var test = compileTest(options);
        return test ? (0, require$$3$1.filter)(test, nodes, recurse, limit) : [];
    }
    exports.getElements = getElements;
    /**
     * @category Legacy Query Functions
     * @param id The unique ID attribute value to look for.
     * @param nodes Nodes to search through.
     * @param recurse Also consider child nodes.
     * @returns The node with the supplied ID.
     */
    function getElementById(id, nodes, recurse) {
        if (recurse === void 0) { recurse = true; }
        if (!Array.isArray(nodes))
            nodes = [nodes];
        return (0, require$$3$1.findOne)(getAttribCheck("id", id), nodes, recurse);
    }
    exports.getElementById = getElementById;
    /**
     * @category Legacy Query Functions
     * @param tagName Tag name to search for.
     * @param nodes Nodes to search through.
     * @param recurse Also consider child nodes.
     * @param limit Maximum number of nodes to return.
     * @returns All nodes with the supplied `tagName`.
     */
    function getElementsByTagName(tagName, nodes, recurse, limit) {
        if (recurse === void 0) { recurse = true; }
        if (limit === void 0) { limit = Infinity; }
        return (0, require$$3$1.filter)(Checks["tag_name"](tagName), nodes, recurse, limit);
    }
    exports.getElementsByTagName = getElementsByTagName;
    /**
     * @category Legacy Query Functions
     * @param type Element type to look for.
     * @param nodes Nodes to search through.
     * @param recurse Also consider child nodes.
     * @param limit Maximum number of nodes to return.
     * @returns All nodes with the supplied `type`.
     */
    function getElementsByTagType(type, nodes, recurse, limit) {
        if (recurse === void 0) { recurse = true; }
        if (limit === void 0) { limit = Infinity; }
        return (0, require$$3$1.filter)(Checks["tag_type"](type), nodes, recurse, limit);
    }
    exports.getElementsByTagType = getElementsByTagType;

    });

    var helpers = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.uniqueSort = exports.compareDocumentPosition = exports.DocumentPosition = exports.removeSubsets = void 0;

    /**
     * Given an array of nodes, remove any member that is contained by another.
     *
     * @category Helpers
     * @param nodes Nodes to filter.
     * @returns Remaining nodes that aren't subtrees of each other.
     */
    function removeSubsets(nodes) {
        var idx = nodes.length;
        /*
         * Check if each node (or one of its ancestors) is already contained in the
         * array.
         */
        while (--idx >= 0) {
            var node = nodes[idx];
            /*
             * Remove the node if it is not unique.
             * We are going through the array from the end, so we only
             * have to check nodes that preceed the node under consideration in the array.
             */
            if (idx > 0 && nodes.lastIndexOf(node, idx - 1) >= 0) {
                nodes.splice(idx, 1);
                continue;
            }
            for (var ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
                if (nodes.includes(ancestor)) {
                    nodes.splice(idx, 1);
                    break;
                }
            }
        }
        return nodes;
    }
    exports.removeSubsets = removeSubsets;
    /**
     * @category Helpers
     * @see {@link http://dom.spec.whatwg.org/#dom-node-comparedocumentposition}
     */
    var DocumentPosition;
    (function (DocumentPosition) {
        DocumentPosition[DocumentPosition["DISCONNECTED"] = 1] = "DISCONNECTED";
        DocumentPosition[DocumentPosition["PRECEDING"] = 2] = "PRECEDING";
        DocumentPosition[DocumentPosition["FOLLOWING"] = 4] = "FOLLOWING";
        DocumentPosition[DocumentPosition["CONTAINS"] = 8] = "CONTAINS";
        DocumentPosition[DocumentPosition["CONTAINED_BY"] = 16] = "CONTAINED_BY";
    })(DocumentPosition = exports.DocumentPosition || (exports.DocumentPosition = {}));
    /**
     * Compare the position of one node against another node in any other document.
     * The return value is a bitmask with the values from {@link DocumentPosition}.
     *
     * Document order:
     * > There is an ordering, document order, defined on all the nodes in the
     * > document corresponding to the order in which the first character of the
     * > XML representation of each node occurs in the XML representation of the
     * > document after expansion of general entities. Thus, the document element
     * > node will be the first node. Element nodes occur before their children.
     * > Thus, document order orders element nodes in order of the occurrence of
     * > their start-tag in the XML (after expansion of entities). The attribute
     * > nodes of an element occur after the element and before its children. The
     * > relative order of attribute nodes is implementation-dependent.
     *
     * Source:
     * http://www.w3.org/TR/DOM-Level-3-Core/glossary.html#dt-document-order
     *
     * @category Helpers
     * @param nodeA The first node to use in the comparison
     * @param nodeB The second node to use in the comparison
     * @returns A bitmask describing the input nodes' relative position.
     *
     * See http://dom.spec.whatwg.org/#dom-node-comparedocumentposition for
     * a description of these values.
     */
    function compareDocumentPosition(nodeA, nodeB) {
        var aParents = [];
        var bParents = [];
        if (nodeA === nodeB) {
            return 0;
        }
        var current = (0, domhandler_1.hasChildren)(nodeA) ? nodeA : nodeA.parent;
        while (current) {
            aParents.unshift(current);
            current = current.parent;
        }
        current = (0, domhandler_1.hasChildren)(nodeB) ? nodeB : nodeB.parent;
        while (current) {
            bParents.unshift(current);
            current = current.parent;
        }
        var maxIdx = Math.min(aParents.length, bParents.length);
        var idx = 0;
        while (idx < maxIdx && aParents[idx] === bParents[idx]) {
            idx++;
        }
        if (idx === 0) {
            return DocumentPosition.DISCONNECTED;
        }
        var sharedParent = aParents[idx - 1];
        var siblings = sharedParent.children;
        var aSibling = aParents[idx];
        var bSibling = bParents[idx];
        if (siblings.indexOf(aSibling) > siblings.indexOf(bSibling)) {
            if (sharedParent === nodeB) {
                return DocumentPosition.FOLLOWING | DocumentPosition.CONTAINED_BY;
            }
            return DocumentPosition.FOLLOWING;
        }
        if (sharedParent === nodeA) {
            return DocumentPosition.PRECEDING | DocumentPosition.CONTAINS;
        }
        return DocumentPosition.PRECEDING;
    }
    exports.compareDocumentPosition = compareDocumentPosition;
    /**
     * Sort an array of nodes based on their relative position in the document and
     * remove any duplicate nodes. If the array contains nodes that do not belong to
     * the same document, sort order is unspecified.
     *
     * @category Helpers
     * @param nodes Array of DOM nodes.
     * @returns Collection of unique nodes, sorted in document order.
     */
    function uniqueSort(nodes) {
        nodes = nodes.filter(function (node, i, arr) { return !arr.includes(node, i + 1); });
        nodes.sort(function (a, b) {
            var relative = compareDocumentPosition(a, b);
            if (relative & DocumentPosition.PRECEDING) {
                return -1;
            }
            else if (relative & DocumentPosition.FOLLOWING) {
                return 1;
            }
            return 0;
        });
        return nodes;
    }
    exports.uniqueSort = uniqueSort;

    });

    var require$$0 = stringify$1;

    var require$$4 = legacy;

    var feeds = createCommonjsModule(function (module, exports) {
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getFeed = void 0;


    /**
     * Get the feed object from the root of a DOM tree.
     *
     * @category Feeds
     * @param doc - The DOM to to extract the feed from.
     * @returns The feed.
     */
    function getFeed(doc) {
        var feedRoot = getOneElement(isValidFeed, doc);
        return !feedRoot
            ? null
            : feedRoot.name === "feed"
                ? getAtomFeed(feedRoot)
                : getRssFeed(feedRoot);
    }
    exports.getFeed = getFeed;
    /**
     * Parse an Atom feed.
     *
     * @param feedRoot The root of the feed.
     * @returns The parsed feed.
     */
    function getAtomFeed(feedRoot) {
        var _a;
        var childs = feedRoot.children;
        var feed = {
            type: "atom",
            items: (0, require$$4.getElementsByTagName)("entry", childs).map(function (item) {
                var _a;
                var children = item.children;
                var entry = { media: getMediaElements(children) };
                addConditionally(entry, "id", "id", children);
                addConditionally(entry, "title", "title", children);
                var href = (_a = getOneElement("link", children)) === null || _a === void 0 ? void 0 : _a.attribs["href"];
                if (href) {
                    entry.link = href;
                }
                var description = fetch("summary", children) || fetch("content", children);
                if (description) {
                    entry.description = description;
                }
                var pubDate = fetch("updated", children);
                if (pubDate) {
                    entry.pubDate = new Date(pubDate);
                }
                return entry;
            }),
        };
        addConditionally(feed, "id", "id", childs);
        addConditionally(feed, "title", "title", childs);
        var href = (_a = getOneElement("link", childs)) === null || _a === void 0 ? void 0 : _a.attribs["href"];
        if (href) {
            feed.link = href;
        }
        addConditionally(feed, "description", "subtitle", childs);
        var updated = fetch("updated", childs);
        if (updated) {
            feed.updated = new Date(updated);
        }
        addConditionally(feed, "author", "email", childs, true);
        return feed;
    }
    /**
     * Parse a RSS feed.
     *
     * @param feedRoot The root of the feed.
     * @returns The parsed feed.
     */
    function getRssFeed(feedRoot) {
        var _a, _b;
        var childs = (_b = (_a = getOneElement("channel", feedRoot.children)) === null || _a === void 0 ? void 0 : _a.children) !== null && _b !== void 0 ? _b : [];
        var feed = {
            type: feedRoot.name.substr(0, 3),
            id: "",
            items: (0, require$$4.getElementsByTagName)("item", feedRoot.children).map(function (item) {
                var children = item.children;
                var entry = { media: getMediaElements(children) };
                addConditionally(entry, "id", "guid", children);
                addConditionally(entry, "title", "title", children);
                addConditionally(entry, "link", "link", children);
                addConditionally(entry, "description", "description", children);
                var pubDate = fetch("pubDate", children);
                if (pubDate)
                    entry.pubDate = new Date(pubDate);
                return entry;
            }),
        };
        addConditionally(feed, "title", "title", childs);
        addConditionally(feed, "link", "link", childs);
        addConditionally(feed, "description", "description", childs);
        var updated = fetch("lastBuildDate", childs);
        if (updated) {
            feed.updated = new Date(updated);
        }
        addConditionally(feed, "author", "managingEditor", childs, true);
        return feed;
    }
    var MEDIA_KEYS_STRING = ["url", "type", "lang"];
    var MEDIA_KEYS_INT = [
        "fileSize",
        "bitrate",
        "framerate",
        "samplingrate",
        "channels",
        "duration",
        "height",
        "width",
    ];
    /**
     * Get all media elements of a feed item.
     *
     * @param where Nodes to search in.
     * @returns Media elements.
     */
    function getMediaElements(where) {
        return (0, require$$4.getElementsByTagName)("media:content", where).map(function (elem) {
            var attribs = elem.attribs;
            var media = {
                medium: attribs["medium"],
                isDefault: !!attribs["isDefault"],
            };
            for (var _i = 0, MEDIA_KEYS_STRING_1 = MEDIA_KEYS_STRING; _i < MEDIA_KEYS_STRING_1.length; _i++) {
                var attrib = MEDIA_KEYS_STRING_1[_i];
                if (attribs[attrib]) {
                    media[attrib] = attribs[attrib];
                }
            }
            for (var _a = 0, MEDIA_KEYS_INT_1 = MEDIA_KEYS_INT; _a < MEDIA_KEYS_INT_1.length; _a++) {
                var attrib = MEDIA_KEYS_INT_1[_a];
                if (attribs[attrib]) {
                    media[attrib] = parseInt(attribs[attrib], 10);
                }
            }
            if (attribs["expression"]) {
                media.expression = attribs["expression"];
            }
            return media;
        });
    }
    /**
     * Get one element by tag name.
     *
     * @param tagName Tag name to look for
     * @param node Node to search in
     * @returns The element or null
     */
    function getOneElement(tagName, node) {
        return (0, require$$4.getElementsByTagName)(tagName, node, true, 1)[0];
    }
    /**
     * Get the text content of an element with a certain tag name.
     *
     * @param tagName Tag name to look for.
     * @param where Node to search in.
     * @param recurse Whether to recurse into child nodes.
     * @returns The text content of the element.
     */
    function fetch(tagName, where, recurse) {
        if (recurse === void 0) { recurse = false; }
        return (0, require$$0.textContent)((0, require$$4.getElementsByTagName)(tagName, where, recurse, 1)).trim();
    }
    /**
     * Adds a property to an object if it has a value.
     *
     * @param obj Object to be extended
     * @param prop Property name
     * @param tagName Tag name that contains the conditionally added property
     * @param where Element to search for the property
     * @param recurse Whether to recurse into child nodes.
     */
    function addConditionally(obj, prop, tagName, where, recurse) {
        if (recurse === void 0) { recurse = false; }
        var val = fetch(tagName, where, recurse);
        if (val)
            obj[prop] = val;
    }
    /**
     * Checks if an element is a feed root node.
     *
     * @param value The name of the element to check.
     * @returns Whether an element is a feed root node.
     */
    function isValidFeed(value) {
        return value === "rss" || value === "feed" || value === "rdf:RDF";
    }

    });

    var require$$1 = traversal;

    var require$$2$1 = manipulation;

    var require$$5 = helpers;

    var require$$6 = feeds;

    var lib$1 = createCommonjsModule(function (module, exports) {
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.hasChildren = exports.isDocument = exports.isComment = exports.isText = exports.isCDATA = exports.isTag = void 0;
    __exportStar(require$$0, exports);
    __exportStar(require$$1, exports);
    __exportStar(require$$2$1, exports);
    __exportStar(require$$3$1, exports);
    __exportStar(require$$4, exports);
    __exportStar(require$$5, exports);
    __exportStar(require$$6, exports);
    /** @deprecated Use these methods from `domhandler` directly. */

    Object.defineProperty(exports, "isTag", { enumerable: true, get: function () { return domhandler_1.isTag; } });
    Object.defineProperty(exports, "isCDATA", { enumerable: true, get: function () { return domhandler_1.isCDATA; } });
    Object.defineProperty(exports, "isText", { enumerable: true, get: function () { return domhandler_1.isText; } });
    Object.defineProperty(exports, "isComment", { enumerable: true, get: function () { return domhandler_1.isComment; } });
    Object.defineProperty(exports, "isDocument", { enumerable: true, get: function () { return domhandler_1.isDocument; } });
    Object.defineProperty(exports, "hasChildren", { enumerable: true, get: function () { return domhandler_1.hasChildren; } });

    });

    var Parser_js_1 = Parser_1;

    var domutils_1 = lib$1;

    var lib = createCommonjsModule(function (module, exports) {
    var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    }));
    var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    });
    var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    };
    var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DefaultHandler = exports.DomUtils = exports.parseFeed = exports.getFeed = exports.ElementType = exports.Tokenizer = exports.createDomStream = exports.parseDOM = exports.parseDocument = exports.DomHandler = exports.Parser = void 0;

    Object.defineProperty(exports, "Parser", { enumerable: true, get: function () { return Parser_js_1.Parser; } });

    Object.defineProperty(exports, "DomHandler", { enumerable: true, get: function () { return domhandler_1.DomHandler; } });
    Object.defineProperty(exports, "DefaultHandler", { enumerable: true, get: function () { return domhandler_1.DomHandler; } });
    // Helper methods
    /**
     * Parses the data, returns the resulting document.
     *
     * @param data The data that should be parsed.
     * @param options Optional options for the parser and DOM builder.
     */
    function parseDocument(data, options) {
        var handler = new domhandler_1.DomHandler(undefined, options);
        new Parser_js_1.Parser(handler, options).end(data);
        return handler.root;
    }
    exports.parseDocument = parseDocument;
    /**
     * Parses data, returns an array of the root nodes.
     *
     * Note that the root nodes still have a `Document` node as their parent.
     * Use `parseDocument` to get the `Document` node instead.
     *
     * @param data The data that should be parsed.
     * @param options Optional options for the parser and DOM builder.
     * @deprecated Use `parseDocument` instead.
     */
    function parseDOM(data, options) {
        return parseDocument(data, options).children;
    }
    exports.parseDOM = parseDOM;
    /**
     * Creates a parser instance, with an attached DOM handler.
     *
     * @param cb A callback that will be called once parsing has been completed.
     * @param options Optional options for the parser and DOM builder.
     * @param elementCb An optional callback that will be called every time a tag has been completed inside of the DOM.
     */
    function createDomStream(cb, options, elementCb) {
        var handler = new domhandler_1.DomHandler(cb, options, elementCb);
        return new Parser_js_1.Parser(handler, options);
    }
    exports.createDomStream = createDomStream;

    Object.defineProperty(exports, "Tokenizer", { enumerable: true, get: function () { return __importDefault(Tokenizer_js_1).default; } });
    /*
     * All of the following exports exist for backwards-compatibility.
     * They should probably be removed eventually.
     */
    var ElementType = __importStar(require$$0$3);
    exports.ElementType = ElementType;

    Object.defineProperty(exports, "getFeed", { enumerable: true, get: function () { return domutils_1.getFeed; } });
    /**
     * Parse a feed.
     *
     * @param feed The feed that should be parsed, as a string.
     * @param options Optionally, options for parsing. When using this, you should set `xmlMode` to `true`.
     */
    function parseFeed(feed, options) {
        if (options === void 0) { options = { xmlMode: true }; }
        return (0, domutils_1.getFeed)(parseDOM(feed, options));
    }
    exports.parseFeed = parseFeed;
    exports.DomUtils = __importStar(domutils_1);

    });

    var escapeStringRegexp = string => {
    	if (typeof string !== 'string') {
    		throw new TypeError('Expected a string');
    	}

    	// Escape characters with special meaning either inside or outside character sets.
    	// Use a simple backslash escape when it’s always valid, and a \unnnn escape when the simpler form would be disallowed by Unicode patterns’ stricter grammar.
    	return string
    		.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
    		.replace(/-/g, '\\x2d');
    };

    /*!
     * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
     *
     * Copyright (c) 2014-2017, Jon Schlinkert.
     * Released under the MIT License.
     */

    function isObject(o) {
      return Object.prototype.toString.call(o) === '[object Object]';
    }

    function isPlainObject$1(o) {
      var ctor,prot;

      if (isObject(o) === false) return false;

      // If has modified constructor
      ctor = o.constructor;
      if (ctor === undefined) return true;

      // If has modified prototype
      prot = ctor.prototype;
      if (isObject(prot) === false) return false;

      // If constructor does not have an Object-specific method
      if (prot.hasOwnProperty('isPrototypeOf') === false) {
        return false;
      }

      // Most likely a plain Object
      return true;
    }

    var isPlainObject_2 = isPlainObject$1;

    var isPlainObject_1 = /*#__PURE__*/Object.defineProperty({
    	isPlainObject: isPlainObject_2
    }, '__esModule', {value: true});

    var isMergeableObject = function isMergeableObject(value) {
    	return isNonNullObject(value)
    		&& !isSpecial(value)
    };

    function isNonNullObject(value) {
    	return !!value && typeof value === 'object'
    }

    function isSpecial(value) {
    	var stringValue = Object.prototype.toString.call(value);

    	return stringValue === '[object RegExp]'
    		|| stringValue === '[object Date]'
    		|| isReactElement(value)
    }

    // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
    var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

    function isReactElement(value) {
    	return value.$$typeof === REACT_ELEMENT_TYPE
    }

    function emptyTarget(val) {
    	return Array.isArray(val) ? [] : {}
    }

    function cloneUnlessOtherwiseSpecified(value, options) {
    	return (options.clone !== false && options.isMergeableObject(value))
    		? deepmerge(emptyTarget(value), value, options)
    		: value
    }

    function defaultArrayMerge(target, source, options) {
    	return target.concat(source).map(function(element) {
    		return cloneUnlessOtherwiseSpecified(element, options)
    	})
    }

    function getMergeFunction(key, options) {
    	if (!options.customMerge) {
    		return deepmerge
    	}
    	var customMerge = options.customMerge(key);
    	return typeof customMerge === 'function' ? customMerge : deepmerge
    }

    function getEnumerableOwnPropertySymbols(target) {
    	return Object.getOwnPropertySymbols
    		? Object.getOwnPropertySymbols(target).filter(function(symbol) {
    			return target.propertyIsEnumerable(symbol)
    		})
    		: []
    }

    function getKeys(target) {
    	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
    }

    function propertyIsOnObject(object, property) {
    	try {
    		return property in object
    	} catch(_) {
    		return false
    	}
    }

    // Protects from prototype poisoning and unexpected merging up the prototype chain.
    function propertyIsUnsafe(target, key) {
    	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
    		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
    			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
    }

    function mergeObject(target, source, options) {
    	var destination = {};
    	if (options.isMergeableObject(target)) {
    		getKeys(target).forEach(function(key) {
    			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    		});
    	}
    	getKeys(source).forEach(function(key) {
    		if (propertyIsUnsafe(target, key)) {
    			return
    		}

    		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
    			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
    		} else {
    			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
    		}
    	});
    	return destination
    }

    function deepmerge(target, source, options) {
    	options = options || {};
    	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
    	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
    	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
    	// implementations can use it. The caller may not replace it.
    	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

    	var sourceIsArray = Array.isArray(source);
    	var targetIsArray = Array.isArray(target);
    	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

    	if (!sourceAndTargetTypesMatch) {
    		return cloneUnlessOtherwiseSpecified(source, options)
    	} else if (sourceIsArray) {
    		return options.arrayMerge(target, source, options)
    	} else {
    		return mergeObject(target, source, options)
    	}
    }

    deepmerge.all = function deepmergeAll(array, options) {
    	if (!Array.isArray(array)) {
    		throw new Error('first argument should be an array')
    	}

    	return array.reduce(function(prev, next) {
    		return deepmerge(prev, next, options)
    	}, {})
    };

    var deepmerge_1 = deepmerge;

    var cjs = deepmerge_1;

    /**
     * Srcset Parser
     *
     * By Alex Bell |  MIT License
     *
     * JS Parser for the string value that appears in markup <img srcset="here">
     *
     * @returns Array [{url: _, d: _, w: _, h:_}, ...]
     *
     * Based super duper closely on the reference algorithm at:
     * https://html.spec.whatwg.org/multipage/embedded-content.html#parse-a-srcset-attribute
     *
     * Most comments are copied in directly from the spec
     * (except for comments in parens).
     */

    var parseSrcset = createCommonjsModule(function (module) {
    (function (root, factory) {
    	if (module.exports) {
    		// Node. Does not work with strict CommonJS, but
    		// only CommonJS-like environments that support module.exports,
    		// like Node.
    		module.exports = factory();
    	} else {
    		// Browser globals (root is window)
    		root.parseSrcset = factory();
    	}
    }(commonjsGlobal, function () {

    	// 1. Let input be the value passed to this algorithm.
    	return function (input) {

    		// UTILITY FUNCTIONS

    		// Manual is faster than RegEx
    		// http://bjorn.tipling.com/state-and-regular-expressions-in-javascript
    		// http://jsperf.com/whitespace-character/5
    		function isSpace(c) {
    			return (c === "\u0020" || // space
    			c === "\u0009" || // horizontal tab
    			c === "\u000A" || // new line
    			c === "\u000C" || // form feed
    			c === "\u000D");  // carriage return
    		}

    		function collectCharacters(regEx) {
    			var chars,
    				match = regEx.exec(input.substring(pos));
    			if (match) {
    				chars = match[ 0 ];
    				pos += chars.length;
    				return chars;
    			}
    		}

    		var inputLength = input.length,

    			// (Don't use \s, to avoid matching non-breaking space)
    			regexLeadingSpaces = /^[ \t\n\r\u000c]+/,
    			regexLeadingCommasOrSpaces = /^[, \t\n\r\u000c]+/,
    			regexLeadingNotSpaces = /^[^ \t\n\r\u000c]+/,
    			regexTrailingCommas = /[,]+$/,
    			regexNonNegativeInteger = /^\d+$/,

    			// ( Positive or negative or unsigned integers or decimals, without or without exponents.
    			// Must include at least one digit.
    			// According to spec tests any decimal point must be followed by a digit.
    			// No leading plus sign is allowed.)
    			// https://html.spec.whatwg.org/multipage/infrastructure.html#valid-floating-point-number
    			regexFloatingPoint = /^-?(?:[0-9]+|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/,

    			url,
    			descriptors,
    			currentDescriptor,
    			state,
    			c,

    			// 2. Let position be a pointer into input, initially pointing at the start
    			//    of the string.
    			pos = 0,

    			// 3. Let candidates be an initially empty source set.
    			candidates = [];

    		// 4. Splitting loop: Collect a sequence of characters that are space
    		//    characters or U+002C COMMA characters. If any U+002C COMMA characters
    		//    were collected, that is a parse error.
    		while (true) {
    			collectCharacters(regexLeadingCommasOrSpaces);

    			// 5. If position is past the end of input, return candidates and abort these steps.
    			if (pos >= inputLength) {
    				return candidates; // (we're done, this is the sole return path)
    			}

    			// 6. Collect a sequence of characters that are not space characters,
    			//    and let that be url.
    			url = collectCharacters(regexLeadingNotSpaces);

    			// 7. Let descriptors be a new empty list.
    			descriptors = [];

    			// 8. If url ends with a U+002C COMMA character (,), follow these substeps:
    			//		(1). Remove all trailing U+002C COMMA characters from url. If this removed
    			//         more than one character, that is a parse error.
    			if (url.slice(-1) === ",") {
    				url = url.replace(regexTrailingCommas, "");
    				// (Jump ahead to step 9 to skip tokenization and just push the candidate).
    				parseDescriptors();

    				//	Otherwise, follow these substeps:
    			} else {
    				tokenize();
    			} // (close else of step 8)

    			// 16. Return to the step labeled splitting loop.
    		} // (Close of big while loop.)

    		/**
    		 * Tokenizes descriptor properties prior to parsing
    		 * Returns undefined.
    		 */
    		function tokenize() {

    			// 8.1. Descriptor tokeniser: Skip whitespace
    			collectCharacters(regexLeadingSpaces);

    			// 8.2. Let current descriptor be the empty string.
    			currentDescriptor = "";

    			// 8.3. Let state be in descriptor.
    			state = "in descriptor";

    			while (true) {

    				// 8.4. Let c be the character at position.
    				c = input.charAt(pos);

    				//  Do the following depending on the value of state.
    				//  For the purpose of this step, "EOF" is a special character representing
    				//  that position is past the end of input.

    				// In descriptor
    				if (state === "in descriptor") {
    					// Do the following, depending on the value of c:

    					// Space character
    					// If current descriptor is not empty, append current descriptor to
    					// descriptors and let current descriptor be the empty string.
    					// Set state to after descriptor.
    					if (isSpace(c)) {
    						if (currentDescriptor) {
    							descriptors.push(currentDescriptor);
    							currentDescriptor = "";
    							state = "after descriptor";
    						}

    						// U+002C COMMA (,)
    						// Advance position to the next character in input. If current descriptor
    						// is not empty, append current descriptor to descriptors. Jump to the step
    						// labeled descriptor parser.
    					} else if (c === ",") {
    						pos += 1;
    						if (currentDescriptor) {
    							descriptors.push(currentDescriptor);
    						}
    						parseDescriptors();
    						return;

    						// U+0028 LEFT PARENTHESIS (()
    						// Append c to current descriptor. Set state to in parens.
    					} else if (c === "\u0028") {
    						currentDescriptor = currentDescriptor + c;
    						state = "in parens";

    						// EOF
    						// If current descriptor is not empty, append current descriptor to
    						// descriptors. Jump to the step labeled descriptor parser.
    					} else if (c === "") {
    						if (currentDescriptor) {
    							descriptors.push(currentDescriptor);
    						}
    						parseDescriptors();
    						return;

    						// Anything else
    						// Append c to current descriptor.
    					} else {
    						currentDescriptor = currentDescriptor + c;
    					}
    					// (end "in descriptor"

    					// In parens
    				} else if (state === "in parens") {

    					// U+0029 RIGHT PARENTHESIS ())
    					// Append c to current descriptor. Set state to in descriptor.
    					if (c === ")") {
    						currentDescriptor = currentDescriptor + c;
    						state = "in descriptor";

    						// EOF
    						// Append current descriptor to descriptors. Jump to the step labeled
    						// descriptor parser.
    					} else if (c === "") {
    						descriptors.push(currentDescriptor);
    						parseDescriptors();
    						return;

    						// Anything else
    						// Append c to current descriptor.
    					} else {
    						currentDescriptor = currentDescriptor + c;
    					}

    					// After descriptor
    				} else if (state === "after descriptor") {

    					// Do the following, depending on the value of c:
    					// Space character: Stay in this state.
    					if (isSpace(c)) ; else if (c === "") {
    						parseDescriptors();
    						return;

    						// Anything else
    						// Set state to in descriptor. Set position to the previous character in input.
    					} else {
    						state = "in descriptor";
    						pos -= 1;

    					}
    				}

    				// Advance position to the next character in input.
    				pos += 1;

    				// Repeat this step.
    			} // (close while true loop)
    		}

    		/**
    		 * Adds descriptor properties to a candidate, pushes to the candidates array
    		 * @return undefined
    		 */
    		// Declared outside of the while loop so that it's only created once.
    		function parseDescriptors() {

    			// 9. Descriptor parser: Let error be no.
    			var pError = false,

    				// 10. Let width be absent.
    				// 11. Let density be absent.
    				// 12. Let future-compat-h be absent. (We're implementing it now as h)
    				w, d, h, i,
    				candidate = {},
    				desc, lastChar, value, intVal, floatVal;

    			// 13. For each descriptor in descriptors, run the appropriate set of steps
    			// from the following list:
    			for (i = 0 ; i < descriptors.length; i++) {
    				desc = descriptors[ i ];

    				lastChar = desc[ desc.length - 1 ];
    				value = desc.substring(0, desc.length - 1);
    				intVal = parseInt(value, 10);
    				floatVal = parseFloat(value);

    				// If the descriptor consists of a valid non-negative integer followed by
    				// a U+0077 LATIN SMALL LETTER W character
    				if (regexNonNegativeInteger.test(value) && (lastChar === "w")) {

    					// If width and density are not both absent, then let error be yes.
    					if (w || d) {pError = true;}

    					// Apply the rules for parsing non-negative integers to the descriptor.
    					// If the result is zero, let error be yes.
    					// Otherwise, let width be the result.
    					if (intVal === 0) {pError = true;} else {w = intVal;}

    					// If the descriptor consists of a valid floating-point number followed by
    					// a U+0078 LATIN SMALL LETTER X character
    				} else if (regexFloatingPoint.test(value) && (lastChar === "x")) {

    					// If width, density and future-compat-h are not all absent, then let error
    					// be yes.
    					if (w || d || h) {pError = true;}

    					// Apply the rules for parsing floating-point number values to the descriptor.
    					// If the result is less than zero, let error be yes. Otherwise, let density
    					// be the result.
    					if (floatVal < 0) {pError = true;} else {d = floatVal;}

    					// If the descriptor consists of a valid non-negative integer followed by
    					// a U+0068 LATIN SMALL LETTER H character
    				} else if (regexNonNegativeInteger.test(value) && (lastChar === "h")) {

    					// If height and density are not both absent, then let error be yes.
    					if (h || d) {pError = true;}

    					// Apply the rules for parsing non-negative integers to the descriptor.
    					// If the result is zero, let error be yes. Otherwise, let future-compat-h
    					// be the result.
    					if (intVal === 0) {pError = true;} else {h = intVal;}

    					// Anything else, Let error be yes.
    				} else {pError = true;}
    			} // (close step 13 for loop)

    			// 15. If error is still no, then append a new image source to candidates whose
    			// URL is url, associated with a width width if not absent and a pixel
    			// density density if not absent. Otherwise, there is a parse error.
    			if (!pError) {
    				candidate.url = url;
    				if (w) { candidate.w = w;}
    				if (d) { candidate.d = d;}
    				if (h) { candidate.h = h;}
    				candidates.push(candidate);
    			} else if (console && console.log) {
    				console.log("Invalid srcset descriptor found in '" +
    					input + "' at '" + desc + "'.");
    			}
    		} // (close parseDescriptors fn)

    	}
    }));
    });

    var x=String;
    var create=function() {return {isColorSupported:false,reset:x,bold:x,dim:x,italic:x,underline:x,inverse:x,hidden:x,strikethrough:x,black:x,red:x,green:x,yellow:x,blue:x,magenta:x,cyan:x,white:x,gray:x,bgBlack:x,bgRed:x,bgGreen:x,bgYellow:x,bgBlue:x,bgMagenta:x,bgCyan:x,bgWhite:x}};
    var picocolors_browser=create();
    var createColors = create;
    picocolors_browser.createColors = createColors;

    var _nodeResolve_empty = {};

    var _nodeResolve_empty$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': _nodeResolve_empty
    });

    var pico = picocolors_browser;

    var require$$2 = /*@__PURE__*/getAugmentedNamespace(_nodeResolve_empty$1);

    class CssSyntaxError extends Error {
      constructor(message, line, column, source, file, plugin) {
        super(message);
        this.name = 'CssSyntaxError';
        this.reason = message;

        if (file) {
          this.file = file;
        }
        if (source) {
          this.source = source;
        }
        if (plugin) {
          this.plugin = plugin;
        }
        if (typeof line !== 'undefined' && typeof column !== 'undefined') {
          if (typeof line === 'number') {
            this.line = line;
            this.column = column;
          } else {
            this.line = line.line;
            this.column = line.column;
            this.endLine = column.line;
            this.endColumn = column.column;
          }
        }

        this.setMessage();

        if (Error.captureStackTrace) {
          Error.captureStackTrace(this, CssSyntaxError);
        }
      }

      setMessage() {
        this.message = this.plugin ? this.plugin + ': ' : '';
        this.message += this.file ? this.file : '<css input>';
        if (typeof this.line !== 'undefined') {
          this.message += ':' + this.line + ':' + this.column;
        }
        this.message += ': ' + this.reason;
      }

      showSourceCode(color) {
        if (!this.source) return ''

        let css = this.source;
        if (color == null) color = pico.isColorSupported;
        if (require$$2) {
          if (color) css = require$$2(css);
        }

        let lines = css.split(/\r?\n/);
        let start = Math.max(this.line - 3, 0);
        let end = Math.min(this.line + 2, lines.length);

        let maxWidth = String(end).length;

        let mark, aside;
        if (color) {
          let { bold, red, gray } = pico.createColors(true);
          mark = text => bold(red(text));
          aside = text => gray(text);
        } else {
          mark = aside = str => str;
        }

        return lines
          .slice(start, end)
          .map((line, index) => {
            let number = start + 1 + index;
            let gutter = ' ' + (' ' + number).slice(-maxWidth) + ' | ';
            if (number === this.line) {
              let spacing =
                aside(gutter.replace(/\d/g, ' ')) +
                line.slice(0, this.column - 1).replace(/[^\t]/g, ' ');
              return mark('>') + aside(gutter) + line + '\n ' + spacing + mark('^')
            }
            return ' ' + aside(gutter) + line
          })
          .join('\n')
      }

      toString() {
        let code = this.showSourceCode();
        if (code) {
          code = '\n\n' + code + '\n';
        }
        return this.name + ': ' + this.message + code
      }
    }

    var cssSyntaxError = CssSyntaxError;
    CssSyntaxError.default = CssSyntaxError;

    var isClean$3 = Symbol('isClean');

    var my$3 = Symbol('my');

    var symbols = {
    	isClean: isClean$3,
    	my: my$3
    };

    const DEFAULT_RAW = {
      colon: ': ',
      indent: '    ',
      beforeDecl: '\n',
      beforeRule: '\n',
      beforeOpen: ' ',
      beforeClose: '\n',
      beforeComment: '\n',
      after: '\n',
      emptyBody: '',
      commentLeft: ' ',
      commentRight: ' ',
      semicolon: false
    };

    function capitalize(str) {
      return str[0].toUpperCase() + str.slice(1)
    }

    class Stringifier {
      constructor(builder) {
        this.builder = builder;
      }

      stringify(node, semicolon) {
        /* c8 ignore start */
        if (!this[node.type]) {
          throw new Error(
            'Unknown AST node type ' +
              node.type +
              '. ' +
              'Maybe you need to change PostCSS stringifier.'
          )
        }
        /* c8 ignore stop */
        this[node.type](node, semicolon);
      }

      document(node) {
        this.body(node);
      }

      root(node) {
        this.body(node);
        if (node.raws.after) this.builder(node.raws.after);
      }

      comment(node) {
        let left = this.raw(node, 'left', 'commentLeft');
        let right = this.raw(node, 'right', 'commentRight');
        this.builder('/*' + left + node.text + right + '*/', node);
      }

      decl(node, semicolon) {
        let between = this.raw(node, 'between', 'colon');
        let string = node.prop + between + this.rawValue(node, 'value');

        if (node.important) {
          string += node.raws.important || ' !important';
        }

        if (semicolon) string += ';';
        this.builder(string, node);
      }

      rule(node) {
        this.block(node, this.rawValue(node, 'selector'));
        if (node.raws.ownSemicolon) {
          this.builder(node.raws.ownSemicolon, node, 'end');
        }
      }

      atrule(node, semicolon) {
        let name = '@' + node.name;
        let params = node.params ? this.rawValue(node, 'params') : '';

        if (typeof node.raws.afterName !== 'undefined') {
          name += node.raws.afterName;
        } else if (params) {
          name += ' ';
        }

        if (node.nodes) {
          this.block(node, name + params);
        } else {
          let end = (node.raws.between || '') + (semicolon ? ';' : '');
          this.builder(name + params + end, node);
        }
      }

      body(node) {
        let last = node.nodes.length - 1;
        while (last > 0) {
          if (node.nodes[last].type !== 'comment') break
          last -= 1;
        }

        let semicolon = this.raw(node, 'semicolon');
        for (let i = 0; i < node.nodes.length; i++) {
          let child = node.nodes[i];
          let before = this.raw(child, 'before');
          if (before) this.builder(before);
          this.stringify(child, last !== i || semicolon);
        }
      }

      block(node, start) {
        let between = this.raw(node, 'between', 'beforeOpen');
        this.builder(start + between + '{', node, 'start');

        let after;
        if (node.nodes && node.nodes.length) {
          this.body(node);
          after = this.raw(node, 'after');
        } else {
          after = this.raw(node, 'after', 'emptyBody');
        }

        if (after) this.builder(after);
        this.builder('}', node, 'end');
      }

      raw(node, own, detect) {
        let value;
        if (!detect) detect = own;

        // Already had
        if (own) {
          value = node.raws[own];
          if (typeof value !== 'undefined') return value
        }

        let parent = node.parent;

        if (detect === 'before') {
          // Hack for first rule in CSS
          if (!parent || (parent.type === 'root' && parent.first === node)) {
            return ''
          }

          // `root` nodes in `document` should use only their own raws
          if (parent && parent.type === 'document') {
            return ''
          }
        }

        // Floating child without parent
        if (!parent) return DEFAULT_RAW[detect]

        // Detect style by other nodes
        let root = node.root();
        if (!root.rawCache) root.rawCache = {};
        if (typeof root.rawCache[detect] !== 'undefined') {
          return root.rawCache[detect]
        }

        if (detect === 'before' || detect === 'after') {
          return this.beforeAfter(node, detect)
        } else {
          let method = 'raw' + capitalize(detect);
          if (this[method]) {
            value = this[method](root, node);
          } else {
            root.walk(i => {
              value = i.raws[own];
              if (typeof value !== 'undefined') return false
            });
          }
        }

        if (typeof value === 'undefined') value = DEFAULT_RAW[detect];

        root.rawCache[detect] = value;
        return value
      }

      rawSemicolon(root) {
        let value;
        root.walk(i => {
          if (i.nodes && i.nodes.length && i.last.type === 'decl') {
            value = i.raws.semicolon;
            if (typeof value !== 'undefined') return false
          }
        });
        return value
      }

      rawEmptyBody(root) {
        let value;
        root.walk(i => {
          if (i.nodes && i.nodes.length === 0) {
            value = i.raws.after;
            if (typeof value !== 'undefined') return false
          }
        });
        return value
      }

      rawIndent(root) {
        if (root.raws.indent) return root.raws.indent
        let value;
        root.walk(i => {
          let p = i.parent;
          if (p && p !== root && p.parent && p.parent === root) {
            if (typeof i.raws.before !== 'undefined') {
              let parts = i.raws.before.split('\n');
              value = parts[parts.length - 1];
              value = value.replace(/\S/g, '');
              return false
            }
          }
        });
        return value
      }

      rawBeforeComment(root, node) {
        let value;
        root.walkComments(i => {
          if (typeof i.raws.before !== 'undefined') {
            value = i.raws.before;
            if (value.includes('\n')) {
              value = value.replace(/[^\n]+$/, '');
            }
            return false
          }
        });
        if (typeof value === 'undefined') {
          value = this.raw(node, null, 'beforeDecl');
        } else if (value) {
          value = value.replace(/\S/g, '');
        }
        return value
      }

      rawBeforeDecl(root, node) {
        let value;
        root.walkDecls(i => {
          if (typeof i.raws.before !== 'undefined') {
            value = i.raws.before;
            if (value.includes('\n')) {
              value = value.replace(/[^\n]+$/, '');
            }
            return false
          }
        });
        if (typeof value === 'undefined') {
          value = this.raw(node, null, 'beforeRule');
        } else if (value) {
          value = value.replace(/\S/g, '');
        }
        return value
      }

      rawBeforeRule(root) {
        let value;
        root.walk(i => {
          if (i.nodes && (i.parent !== root || root.first !== i)) {
            if (typeof i.raws.before !== 'undefined') {
              value = i.raws.before;
              if (value.includes('\n')) {
                value = value.replace(/[^\n]+$/, '');
              }
              return false
            }
          }
        });
        if (value) value = value.replace(/\S/g, '');
        return value
      }

      rawBeforeClose(root) {
        let value;
        root.walk(i => {
          if (i.nodes && i.nodes.length > 0) {
            if (typeof i.raws.after !== 'undefined') {
              value = i.raws.after;
              if (value.includes('\n')) {
                value = value.replace(/[^\n]+$/, '');
              }
              return false
            }
          }
        });
        if (value) value = value.replace(/\S/g, '');
        return value
      }

      rawBeforeOpen(root) {
        let value;
        root.walk(i => {
          if (i.type !== 'decl') {
            value = i.raws.between;
            if (typeof value !== 'undefined') return false
          }
        });
        return value
      }

      rawColon(root) {
        let value;
        root.walkDecls(i => {
          if (typeof i.raws.between !== 'undefined') {
            value = i.raws.between.replace(/[^\s:]/g, '');
            return false
          }
        });
        return value
      }

      beforeAfter(node, detect) {
        let value;
        if (node.type === 'decl') {
          value = this.raw(node, null, 'beforeDecl');
        } else if (node.type === 'comment') {
          value = this.raw(node, null, 'beforeComment');
        } else if (detect === 'before') {
          value = this.raw(node, null, 'beforeRule');
        } else {
          value = this.raw(node, null, 'beforeClose');
        }

        let buf = node.parent;
        let depth = 0;
        while (buf && buf.type !== 'root') {
          depth += 1;
          buf = buf.parent;
        }

        if (value.includes('\n')) {
          let indent = this.raw(node, null, 'indent');
          if (indent.length) {
            for (let step = 0; step < depth; step++) value += indent;
          }
        }

        return value
      }

      rawValue(node, prop) {
        let value = node[prop];
        let raw = node.raws[prop];
        if (raw && raw.value === value) {
          return raw.raw
        }

        return value
      }
    }

    var stringifier = Stringifier;
    Stringifier.default = Stringifier;

    function stringify(node, builder) {
      let str = new stringifier(builder);
      str.stringify(node);
    }

    var stringify_1 = stringify;
    stringify.default = stringify;

    let { isClean: isClean$2, my: my$2 } = symbols;




    function cloneNode(obj, parent) {
      let cloned = new obj.constructor();

      for (let i in obj) {
        if (!Object.prototype.hasOwnProperty.call(obj, i)) {
          /* c8 ignore next 2 */
          continue
        }
        if (i === 'proxyCache') continue
        let value = obj[i];
        let type = typeof value;

        if (i === 'parent' && type === 'object') {
          if (parent) cloned[i] = parent;
        } else if (i === 'source') {
          cloned[i] = value;
        } else if (Array.isArray(value)) {
          cloned[i] = value.map(j => cloneNode(j, cloned));
        } else {
          if (type === 'object' && value !== null) value = cloneNode(value);
          cloned[i] = value;
        }
      }

      return cloned
    }

    class Node {
      constructor(defaults = {}) {
        this.raws = {};
        this[isClean$2] = false;
        this[my$2] = true;

        for (let name in defaults) {
          if (name === 'nodes') {
            this.nodes = [];
            for (let node of defaults[name]) {
              if (typeof node.clone === 'function') {
                this.append(node.clone());
              } else {
                this.append(node);
              }
            }
          } else {
            this[name] = defaults[name];
          }
        }
      }

      error(message, opts = {}) {
        if (this.source) {
          let { start, end } = this.rangeBy(opts);
          return this.source.input.error(
            message,
            { line: start.line, column: start.column },
            { line: end.line, column: end.column },
            opts
          )
        }
        return new cssSyntaxError(message)
      }

      warn(result, text, opts) {
        let data = { node: this };
        for (let i in opts) data[i] = opts[i];
        return result.warn(text, data)
      }

      remove() {
        if (this.parent) {
          this.parent.removeChild(this);
        }
        this.parent = undefined;
        return this
      }

      toString(stringifier = stringify_1) {
        if (stringifier.stringify) stringifier = stringifier.stringify;
        let result = '';
        stringifier(this, i => {
          result += i;
        });
        return result
      }

      assign(overrides = {}) {
        for (let name in overrides) {
          this[name] = overrides[name];
        }
        return this
      }

      clone(overrides = {}) {
        let cloned = cloneNode(this);
        for (let name in overrides) {
          cloned[name] = overrides[name];
        }
        return cloned
      }

      cloneBefore(overrides = {}) {
        let cloned = this.clone(overrides);
        this.parent.insertBefore(this, cloned);
        return cloned
      }

      cloneAfter(overrides = {}) {
        let cloned = this.clone(overrides);
        this.parent.insertAfter(this, cloned);
        return cloned
      }

      replaceWith(...nodes) {
        if (this.parent) {
          let bookmark = this;
          let foundSelf = false;
          for (let node of nodes) {
            if (node === this) {
              foundSelf = true;
            } else if (foundSelf) {
              this.parent.insertAfter(bookmark, node);
              bookmark = node;
            } else {
              this.parent.insertBefore(bookmark, node);
            }
          }

          if (!foundSelf) {
            this.remove();
          }
        }

        return this
      }

      next() {
        if (!this.parent) return undefined
        let index = this.parent.index(this);
        return this.parent.nodes[index + 1]
      }

      prev() {
        if (!this.parent) return undefined
        let index = this.parent.index(this);
        return this.parent.nodes[index - 1]
      }

      before(add) {
        this.parent.insertBefore(this, add);
        return this
      }

      after(add) {
        this.parent.insertAfter(this, add);
        return this
      }

      root() {
        let result = this;
        while (result.parent && result.parent.type !== 'document') {
          result = result.parent;
        }
        return result
      }

      raw(prop, defaultType) {
        let str = new stringifier();
        return str.raw(this, prop, defaultType)
      }

      cleanRaws(keepBetween) {
        delete this.raws.before;
        delete this.raws.after;
        if (!keepBetween) delete this.raws.between;
      }

      toJSON(_, inputs) {
        let fixed = {};
        let emitInputs = inputs == null;
        inputs = inputs || new Map();
        let inputsNextIndex = 0;

        for (let name in this) {
          if (!Object.prototype.hasOwnProperty.call(this, name)) {
            /* c8 ignore next 2 */
            continue
          }
          if (name === 'parent' || name === 'proxyCache') continue
          let value = this[name];

          if (Array.isArray(value)) {
            fixed[name] = value.map(i => {
              if (typeof i === 'object' && i.toJSON) {
                return i.toJSON(null, inputs)
              } else {
                return i
              }
            });
          } else if (typeof value === 'object' && value.toJSON) {
            fixed[name] = value.toJSON(null, inputs);
          } else if (name === 'source') {
            let inputId = inputs.get(value.input);
            if (inputId == null) {
              inputId = inputsNextIndex;
              inputs.set(value.input, inputsNextIndex);
              inputsNextIndex++;
            }
            fixed[name] = {
              inputId,
              start: value.start,
              end: value.end
            };
          } else {
            fixed[name] = value;
          }
        }

        if (emitInputs) {
          fixed.inputs = [...inputs.keys()].map(input => input.toJSON());
        }

        return fixed
      }

      positionInside(index) {
        let string = this.toString();
        let column = this.source.start.column;
        let line = this.source.start.line;

        for (let i = 0; i < index; i++) {
          if (string[i] === '\n') {
            column = 1;
            line += 1;
          } else {
            column += 1;
          }
        }

        return { line, column }
      }

      positionBy(opts) {
        let pos = this.source.start;
        if (opts.index) {
          pos = this.positionInside(opts.index);
        } else if (opts.word) {
          let index = this.toString().indexOf(opts.word);
          if (index !== -1) pos = this.positionInside(index);
        }
        return pos
      }

      rangeBy(opts) {
        let start = {
          line: this.source.start.line,
          column: this.source.start.column
        };
        let end = this.source.end
          ? {
              line: this.source.end.line,
              column: this.source.end.column + 1
            }
          : {
              line: start.line,
              column: start.column + 1
            };

        if (opts.word) {
          let index = this.toString().indexOf(opts.word);
          if (index !== -1) {
            start = this.positionInside(index);
            end = this.positionInside(index + opts.word.length);
          }
        } else {
          if (opts.start) {
            start = {
              line: opts.start.line,
              column: opts.start.column
            };
          } else if (opts.index) {
            start = this.positionInside(opts.index);
          }

          if (opts.end) {
            end = {
              line: opts.end.line,
              column: opts.end.column
            };
          } else if (opts.endIndex) {
            end = this.positionInside(opts.endIndex);
          } else if (opts.index) {
            end = this.positionInside(opts.index + 1);
          }
        }

        if (
          end.line < start.line ||
          (end.line === start.line && end.column <= start.column)
        ) {
          end = { line: start.line, column: start.column + 1 };
        }

        return { start, end }
      }

      getProxyProcessor() {
        return {
          set(node, prop, value) {
            if (node[prop] === value) return true
            node[prop] = value;
            if (
              prop === 'prop' ||
              prop === 'value' ||
              prop === 'name' ||
              prop === 'params' ||
              prop === 'important' ||
              /* c8 ignore next */
              prop === 'text'
            ) {
              node.markDirty();
            }
            return true
          },

          get(node, prop) {
            if (prop === 'proxyOf') {
              return node
            } else if (prop === 'root') {
              return () => node.root().toProxy()
            } else {
              return node[prop]
            }
          }
        }
      }

      toProxy() {
        if (!this.proxyCache) {
          this.proxyCache = new Proxy(this, this.getProxyProcessor());
        }
        return this.proxyCache
      }

      addToError(error) {
        error.postcssNode = this;
        if (error.stack && this.source && /\n\s{4}at /.test(error.stack)) {
          let s = this.source;
          error.stack = error.stack.replace(
            /\n\s{4}at /,
            `$&${s.input.from}:${s.start.line}:${s.start.column}$&`
          );
        }
        return error
      }

      markDirty() {
        if (this[isClean$2]) {
          this[isClean$2] = false;
          let next = this;
          while ((next = next.parent)) {
            next[isClean$2] = false;
          }
        }
      }

      get proxyOf() {
        return this
      }
    }

    var node_1 = Node;
    Node.default = Node;

    class Declaration extends node_1 {
      constructor(defaults) {
        if (
          defaults &&
          typeof defaults.value !== 'undefined' &&
          typeof defaults.value !== 'string'
        ) {
          defaults = { ...defaults, value: String(defaults.value) };
        }
        super(defaults);
        this.type = 'decl';
      }

      get variable() {
        return this.prop.startsWith('--') || this.prop[0] === '$'
      }
    }

    var declaration = Declaration;
    Declaration.default = Declaration;

    let urlAlphabet =
      'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';
    let customAlphabet = (alphabet, defaultSize = 21) => {
      return (size = defaultSize) => {
        let id = '';
        let i = size;
        while (i--) {
          id += alphabet[(Math.random() * alphabet.length) | 0];
        }
        return id
      }
    };
    let nanoid$1 = (size = 21) => {
      let id = '';
      let i = size;
      while (i--) {
        id += urlAlphabet[(Math.random() * 64) | 0];
      }
      return id
    };
    var nonSecure = { nanoid: nanoid$1, customAlphabet };

    let { SourceMapConsumer: SourceMapConsumer$2, SourceMapGenerator: SourceMapGenerator$2 } = require$$2;
    let { existsSync, readFileSync } = require$$2;
    let { dirname: dirname$1, join } = require$$2;

    function fromBase64(str) {
      if (Buffer) {
        return Buffer.from(str, 'base64').toString()
      } else {
        /* c8 ignore next 2 */
        return window.atob(str)
      }
    }

    class PreviousMap {
      constructor(css, opts) {
        if (opts.map === false) return
        this.loadAnnotation(css);
        this.inline = this.startWith(this.annotation, 'data:');

        let prev = opts.map ? opts.map.prev : undefined;
        let text = this.loadMap(opts.from, prev);
        if (!this.mapFile && opts.from) {
          this.mapFile = opts.from;
        }
        if (this.mapFile) this.root = dirname$1(this.mapFile);
        if (text) this.text = text;
      }

      consumer() {
        if (!this.consumerCache) {
          this.consumerCache = new SourceMapConsumer$2(this.text);
        }
        return this.consumerCache
      }

      withContent() {
        return !!(
          this.consumer().sourcesContent &&
          this.consumer().sourcesContent.length > 0
        )
      }

      startWith(string, start) {
        if (!string) return false
        return string.substr(0, start.length) === start
      }

      getAnnotationURL(sourceMapString) {
        return sourceMapString.replace(/^\/\*\s*# sourceMappingURL=/, '').trim()
      }

      loadAnnotation(css) {
        let comments = css.match(/\/\*\s*# sourceMappingURL=/gm);
        if (!comments) return

        // sourceMappingURLs from comments, strings, etc.
        let start = css.lastIndexOf(comments.pop());
        let end = css.indexOf('*/', start);

        if (start > -1 && end > -1) {
          // Locate the last sourceMappingURL to avoid pickin
          this.annotation = this.getAnnotationURL(css.substring(start, end));
        }
      }

      decodeInline(text) {
        let baseCharsetUri = /^data:application\/json;charset=utf-?8;base64,/;
        let baseUri = /^data:application\/json;base64,/;
        let charsetUri = /^data:application\/json;charset=utf-?8,/;
        let uri = /^data:application\/json,/;

        if (charsetUri.test(text) || uri.test(text)) {
          return decodeURIComponent(text.substr(RegExp.lastMatch.length))
        }

        if (baseCharsetUri.test(text) || baseUri.test(text)) {
          return fromBase64(text.substr(RegExp.lastMatch.length))
        }

        let encoding = text.match(/data:application\/json;([^,]+),/)[1];
        throw new Error('Unsupported source map encoding ' + encoding)
      }

      loadFile(path) {
        this.root = dirname$1(path);
        if (existsSync(path)) {
          this.mapFile = path;
          return readFileSync(path, 'utf-8').toString().trim()
        }
      }

      loadMap(file, prev) {
        if (prev === false) return false

        if (prev) {
          if (typeof prev === 'string') {
            return prev
          } else if (typeof prev === 'function') {
            let prevPath = prev(file);
            if (prevPath) {
              let map = this.loadFile(prevPath);
              if (!map) {
                throw new Error(
                  'Unable to load previous source map: ' + prevPath.toString()
                )
              }
              return map
            }
          } else if (prev instanceof SourceMapConsumer$2) {
            return SourceMapGenerator$2.fromSourceMap(prev).toString()
          } else if (prev instanceof SourceMapGenerator$2) {
            return prev.toString()
          } else if (this.isMap(prev)) {
            return JSON.stringify(prev)
          } else {
            throw new Error(
              'Unsupported previous source map format: ' + prev.toString()
            )
          }
        } else if (this.inline) {
          return this.decodeInline(this.annotation)
        } else if (this.annotation) {
          let map = this.annotation;
          if (file) map = join(dirname$1(file), map);
          return this.loadFile(map)
        }
      }

      isMap(map) {
        if (typeof map !== 'object') return false
        return (
          typeof map.mappings === 'string' ||
          typeof map._mappings === 'string' ||
          Array.isArray(map.sections)
        )
      }
    }

    var previousMap = PreviousMap;
    PreviousMap.default = PreviousMap;

    var require$$3 = nonSecure;

    let { SourceMapConsumer: SourceMapConsumer$1, SourceMapGenerator: SourceMapGenerator$1 } = require$$2;
    let { fileURLToPath, pathToFileURL: pathToFileURL$1 } = require$$2;
    let { resolve: resolve$1, isAbsolute } = require$$2;
    let { nanoid } = require$$3;





    let fromOffsetCache = Symbol('fromOffsetCache');

    let sourceMapAvailable$1 = Boolean(SourceMapConsumer$1 && SourceMapGenerator$1);
    let pathAvailable$1 = Boolean(resolve$1 && isAbsolute);

    class Input {
      constructor(css, opts = {}) {
        if (
          css === null ||
          typeof css === 'undefined' ||
          (typeof css === 'object' && !css.toString)
        ) {
          throw new Error(`PostCSS received ${css} instead of CSS string`)
        }

        this.css = css.toString();

        if (this.css[0] === '\uFEFF' || this.css[0] === '\uFFFE') {
          this.hasBOM = true;
          this.css = this.css.slice(1);
        } else {
          this.hasBOM = false;
        }

        if (opts.from) {
          if (
            !pathAvailable$1 ||
            /^\w+:\/\//.test(opts.from) ||
            isAbsolute(opts.from)
          ) {
            this.file = opts.from;
          } else {
            this.file = resolve$1(opts.from);
          }
        }

        if (pathAvailable$1 && sourceMapAvailable$1) {
          let map = new previousMap(this.css, opts);
          if (map.text) {
            this.map = map;
            let file = map.consumer().file;
            if (!this.file && file) this.file = this.mapResolve(file);
          }
        }

        if (!this.file) {
          this.id = '<input css ' + nanoid(6) + '>';
        }
        if (this.map) this.map.file = this.from;
      }

      fromOffset(offset) {
        let lastLine, lineToIndex;
        if (!this[fromOffsetCache]) {
          let lines = this.css.split('\n');
          lineToIndex = new Array(lines.length);
          let prevIndex = 0;

          for (let i = 0, l = lines.length; i < l; i++) {
            lineToIndex[i] = prevIndex;
            prevIndex += lines[i].length + 1;
          }

          this[fromOffsetCache] = lineToIndex;
        } else {
          lineToIndex = this[fromOffsetCache];
        }
        lastLine = lineToIndex[lineToIndex.length - 1];

        let min = 0;
        if (offset >= lastLine) {
          min = lineToIndex.length - 1;
        } else {
          let max = lineToIndex.length - 2;
          let mid;
          while (min < max) {
            mid = min + ((max - min) >> 1);
            if (offset < lineToIndex[mid]) {
              max = mid - 1;
            } else if (offset >= lineToIndex[mid + 1]) {
              min = mid + 1;
            } else {
              min = mid;
              break
            }
          }
        }
        return {
          line: min + 1,
          col: offset - lineToIndex[min] + 1
        }
      }

      error(message, line, column, opts = {}) {
        let result, endLine, endColumn;

        if (line && typeof line === 'object') {
          let start = line;
          let end = column;
          if (typeof start.offset === 'number') {
            let pos = this.fromOffset(start.offset);
            line = pos.line;
            column = pos.col;
          } else {
            line = start.line;
            column = start.column;
          }
          if (typeof end.offset === 'number') {
            let pos = this.fromOffset(end.offset);
            endLine = pos.line;
            endColumn = pos.col;
          } else {
            endLine = end.line;
            endColumn = end.column;
          }
        } else if (!column) {
          let pos = this.fromOffset(line);
          line = pos.line;
          column = pos.col;
        }

        let origin = this.origin(line, column, endLine, endColumn);
        if (origin) {
          result = new cssSyntaxError(
            message,
            origin.endLine === undefined
              ? origin.line
              : { line: origin.line, column: origin.column },
            origin.endLine === undefined
              ? origin.column
              : { line: origin.endLine, column: origin.endColumn },
            origin.source,
            origin.file,
            opts.plugin
          );
        } else {
          result = new cssSyntaxError(
            message,
            endLine === undefined ? line : { line, column },
            endLine === undefined ? column : { line: endLine, column: endColumn },
            this.css,
            this.file,
            opts.plugin
          );
        }

        result.input = { line, column, endLine, endColumn, source: this.css };
        if (this.file) {
          if (pathToFileURL$1) {
            result.input.url = pathToFileURL$1(this.file).toString();
          }
          result.input.file = this.file;
        }

        return result
      }

      origin(line, column, endLine, endColumn) {
        if (!this.map) return false
        let consumer = this.map.consumer();

        let from = consumer.originalPositionFor({ line, column });
        if (!from.source) return false

        let to;
        if (typeof endLine === 'number') {
          to = consumer.originalPositionFor({ line: endLine, column: endColumn });
        }

        let fromUrl;

        if (isAbsolute(from.source)) {
          fromUrl = pathToFileURL$1(from.source);
        } else {
          fromUrl = new URL(
            from.source,
            this.map.consumer().sourceRoot || pathToFileURL$1(this.map.mapFile)
          );
        }

        let result = {
          url: fromUrl.toString(),
          line: from.line,
          column: from.column,
          endLine: to && to.line,
          endColumn: to && to.column
        };

        if (fromUrl.protocol === 'file:') {
          if (fileURLToPath) {
            result.file = fileURLToPath(fromUrl);
          } else {
            /* c8 ignore next 2 */
            throw new Error(`file: protocol is not available in this PostCSS build`)
          }
        }

        let source = consumer.sourceContentFor(from.source);
        if (source) result.source = source;

        return result
      }

      mapResolve(file) {
        if (/^\w+:\/\//.test(file)) {
          return file
        }
        return resolve$1(this.map.consumer().sourceRoot || this.map.root || '.', file)
      }

      get from() {
        return this.file || this.id
      }

      toJSON() {
        let json = {};
        for (let name of ['hasBOM', 'css', 'file', 'id']) {
          if (this[name] != null) {
            json[name] = this[name];
          }
        }
        if (this.map) {
          json.map = { ...this.map };
          if (json.map.consumerCache) {
            json.map.consumerCache = undefined;
          }
        }
        return json
      }
    }

    var input = Input;
    Input.default = Input;

    if (require$$2 && require$$2.registerInput) {
      require$$2.registerInput(Input);
    }

    let { SourceMapConsumer, SourceMapGenerator } = require$$2;
    let { dirname, resolve, relative, sep } = require$$2;
    let { pathToFileURL } = require$$2;



    let sourceMapAvailable = Boolean(SourceMapConsumer && SourceMapGenerator);
    let pathAvailable = Boolean(dirname && resolve && relative && sep);

    class MapGenerator {
      constructor(stringify, root, opts, cssString) {
        this.stringify = stringify;
        this.mapOpts = opts.map || {};
        this.root = root;
        this.opts = opts;
        this.css = cssString;
        this.usesFileUrls = !this.mapOpts.from && this.mapOpts.absolute;
      }

      isMap() {
        if (typeof this.opts.map !== 'undefined') {
          return !!this.opts.map
        }
        return this.previous().length > 0
      }

      previous() {
        if (!this.previousMaps) {
          this.previousMaps = [];
          if (this.root) {
            this.root.walk(node => {
              if (node.source && node.source.input.map) {
                let map = node.source.input.map;
                if (!this.previousMaps.includes(map)) {
                  this.previousMaps.push(map);
                }
              }
            });
          } else {
            let input$1 = new input(this.css, this.opts);
            if (input$1.map) this.previousMaps.push(input$1.map);
          }
        }

        return this.previousMaps
      }

      isInline() {
        if (typeof this.mapOpts.inline !== 'undefined') {
          return this.mapOpts.inline
        }

        let annotation = this.mapOpts.annotation;
        if (typeof annotation !== 'undefined' && annotation !== true) {
          return false
        }

        if (this.previous().length) {
          return this.previous().some(i => i.inline)
        }
        return true
      }

      isSourcesContent() {
        if (typeof this.mapOpts.sourcesContent !== 'undefined') {
          return this.mapOpts.sourcesContent
        }
        if (this.previous().length) {
          return this.previous().some(i => i.withContent())
        }
        return true
      }

      clearAnnotation() {
        if (this.mapOpts.annotation === false) return

        if (this.root) {
          let node;
          for (let i = this.root.nodes.length - 1; i >= 0; i--) {
            node = this.root.nodes[i];
            if (node.type !== 'comment') continue
            if (node.text.indexOf('# sourceMappingURL=') === 0) {
              this.root.removeChild(i);
            }
          }
        } else if (this.css) {
          this.css = this.css.replace(/(\n)?\/\*#[\S\s]*?\*\/$/gm, '');
        }
      }

      setSourcesContent() {
        let already = {};
        if (this.root) {
          this.root.walk(node => {
            if (node.source) {
              let from = node.source.input.from;
              if (from && !already[from]) {
                already[from] = true;
                let fromUrl = this.usesFileUrls
                  ? this.toFileUrl(from)
                  : this.toUrl(this.path(from));
                this.map.setSourceContent(fromUrl, node.source.input.css);
              }
            }
          });
        } else if (this.css) {
          let from = this.opts.from
            ? this.toUrl(this.path(this.opts.from))
            : '<no source>';
          this.map.setSourceContent(from, this.css);
        }
      }

      applyPrevMaps() {
        for (let prev of this.previous()) {
          let from = this.toUrl(this.path(prev.file));
          let root = prev.root || dirname(prev.file);
          let map;

          if (this.mapOpts.sourcesContent === false) {
            map = new SourceMapConsumer(prev.text);
            if (map.sourcesContent) {
              map.sourcesContent = map.sourcesContent.map(() => null);
            }
          } else {
            map = prev.consumer();
          }

          this.map.applySourceMap(map, from, this.toUrl(this.path(root)));
        }
      }

      isAnnotation() {
        if (this.isInline()) {
          return true
        }
        if (typeof this.mapOpts.annotation !== 'undefined') {
          return this.mapOpts.annotation
        }
        if (this.previous().length) {
          return this.previous().some(i => i.annotation)
        }
        return true
      }

      toBase64(str) {
        if (Buffer) {
          return Buffer.from(str).toString('base64')
        } else {
          return window.btoa(unescape(encodeURIComponent(str)))
        }
      }

      addAnnotation() {
        let content;

        if (this.isInline()) {
          content =
            'data:application/json;base64,' + this.toBase64(this.map.toString());
        } else if (typeof this.mapOpts.annotation === 'string') {
          content = this.mapOpts.annotation;
        } else if (typeof this.mapOpts.annotation === 'function') {
          content = this.mapOpts.annotation(this.opts.to, this.root);
        } else {
          content = this.outputFile() + '.map';
        }
        let eol = '\n';
        if (this.css.includes('\r\n')) eol = '\r\n';

        this.css += eol + '/*# sourceMappingURL=' + content + ' */';
      }

      outputFile() {
        if (this.opts.to) {
          return this.path(this.opts.to)
        } else if (this.opts.from) {
          return this.path(this.opts.from)
        } else {
          return 'to.css'
        }
      }

      generateMap() {
        if (this.root) {
          this.generateString();
        } else if (this.previous().length === 1) {
          let prev = this.previous()[0].consumer();
          prev.file = this.outputFile();
          this.map = SourceMapGenerator.fromSourceMap(prev);
        } else {
          this.map = new SourceMapGenerator({ file: this.outputFile() });
          this.map.addMapping({
            source: this.opts.from
              ? this.toUrl(this.path(this.opts.from))
              : '<no source>',
            generated: { line: 1, column: 0 },
            original: { line: 1, column: 0 }
          });
        }

        if (this.isSourcesContent()) this.setSourcesContent();
        if (this.root && this.previous().length > 0) this.applyPrevMaps();
        if (this.isAnnotation()) this.addAnnotation();

        if (this.isInline()) {
          return [this.css]
        } else {
          return [this.css, this.map]
        }
      }

      path(file) {
        if (file.indexOf('<') === 0) return file
        if (/^\w+:\/\//.test(file)) return file
        if (this.mapOpts.absolute) return file

        let from = this.opts.to ? dirname(this.opts.to) : '.';

        if (typeof this.mapOpts.annotation === 'string') {
          from = dirname(resolve(from, this.mapOpts.annotation));
        }

        file = relative(from, file);
        return file
      }

      toUrl(path) {
        if (sep === '\\') {
          path = path.replace(/\\/g, '/');
        }
        return encodeURI(path).replace(/[#?]/g, encodeURIComponent)
      }

      toFileUrl(path) {
        if (pathToFileURL) {
          return pathToFileURL(path).toString()
        } else {
          throw new Error(
            '`map.absolute` option is not available in this PostCSS build'
          )
        }
      }

      sourcePath(node) {
        if (this.mapOpts.from) {
          return this.toUrl(this.mapOpts.from)
        } else if (this.usesFileUrls) {
          return this.toFileUrl(node.source.input.from)
        } else {
          return this.toUrl(this.path(node.source.input.from))
        }
      }

      generateString() {
        this.css = '';
        this.map = new SourceMapGenerator({ file: this.outputFile() });

        let line = 1;
        let column = 1;

        let noSource = '<no source>';
        let mapping = {
          source: '',
          generated: { line: 0, column: 0 },
          original: { line: 0, column: 0 }
        };

        let lines, last;
        this.stringify(this.root, (str, node, type) => {
          this.css += str;

          if (node && type !== 'end') {
            mapping.generated.line = line;
            mapping.generated.column = column - 1;
            if (node.source && node.source.start) {
              mapping.source = this.sourcePath(node);
              mapping.original.line = node.source.start.line;
              mapping.original.column = node.source.start.column - 1;
              this.map.addMapping(mapping);
            } else {
              mapping.source = noSource;
              mapping.original.line = 1;
              mapping.original.column = 0;
              this.map.addMapping(mapping);
            }
          }

          lines = str.match(/\n/g);
          if (lines) {
            line += lines.length;
            last = str.lastIndexOf('\n');
            column = str.length - last;
          } else {
            column += str.length;
          }

          if (node && type !== 'start') {
            let p = node.parent || { raws: {} };
            let childless =
              node.type === 'decl' || (node.type === 'atrule' && !node.nodes);
            if (!childless || node !== p.last || p.raws.semicolon) {
              if (node.source && node.source.end) {
                mapping.source = this.sourcePath(node);
                mapping.original.line = node.source.end.line;
                mapping.original.column = node.source.end.column - 1;
                mapping.generated.line = line;
                mapping.generated.column = column - 2;
                this.map.addMapping(mapping);
              } else {
                mapping.source = noSource;
                mapping.original.line = 1;
                mapping.original.column = 0;
                mapping.generated.line = line;
                mapping.generated.column = column - 1;
                this.map.addMapping(mapping);
              }
            }
          }
        });
      }

      generate() {
        this.clearAnnotation();
        if (pathAvailable && sourceMapAvailable && this.isMap()) {
          return this.generateMap()
        } else {
          let result = '';
          this.stringify(this.root, i => {
            result += i;
          });
          return [result]
        }
      }
    }

    var mapGenerator = MapGenerator;

    class Comment extends node_1 {
      constructor(defaults) {
        super(defaults);
        this.type = 'comment';
      }
    }

    var comment = Comment;
    Comment.default = Comment;

    let { isClean: isClean$1, my: my$1 } = symbols;




    let parse$1, Rule$1, AtRule$1, Root$1;

    function cleanSource(nodes) {
      return nodes.map(i => {
        if (i.nodes) i.nodes = cleanSource(i.nodes);
        delete i.source;
        return i
      })
    }

    function markDirtyUp(node) {
      node[isClean$1] = false;
      if (node.proxyOf.nodes) {
        for (let i of node.proxyOf.nodes) {
          markDirtyUp(i);
        }
      }
    }

    class Container extends node_1 {
      push(child) {
        child.parent = this;
        this.proxyOf.nodes.push(child);
        return this
      }

      each(callback) {
        if (!this.proxyOf.nodes) return undefined
        let iterator = this.getIterator();

        let index, result;
        while (this.indexes[iterator] < this.proxyOf.nodes.length) {
          index = this.indexes[iterator];
          result = callback(this.proxyOf.nodes[index], index);
          if (result === false) break

          this.indexes[iterator] += 1;
        }

        delete this.indexes[iterator];
        return result
      }

      walk(callback) {
        return this.each((child, i) => {
          let result;
          try {
            result = callback(child, i);
          } catch (e) {
            throw child.addToError(e)
          }
          if (result !== false && child.walk) {
            result = child.walk(callback);
          }

          return result
        })
      }

      walkDecls(prop, callback) {
        if (!callback) {
          callback = prop;
          return this.walk((child, i) => {
            if (child.type === 'decl') {
              return callback(child, i)
            }
          })
        }
        if (prop instanceof RegExp) {
          return this.walk((child, i) => {
            if (child.type === 'decl' && prop.test(child.prop)) {
              return callback(child, i)
            }
          })
        }
        return this.walk((child, i) => {
          if (child.type === 'decl' && child.prop === prop) {
            return callback(child, i)
          }
        })
      }

      walkRules(selector, callback) {
        if (!callback) {
          callback = selector;

          return this.walk((child, i) => {
            if (child.type === 'rule') {
              return callback(child, i)
            }
          })
        }
        if (selector instanceof RegExp) {
          return this.walk((child, i) => {
            if (child.type === 'rule' && selector.test(child.selector)) {
              return callback(child, i)
            }
          })
        }
        return this.walk((child, i) => {
          if (child.type === 'rule' && child.selector === selector) {
            return callback(child, i)
          }
        })
      }

      walkAtRules(name, callback) {
        if (!callback) {
          callback = name;
          return this.walk((child, i) => {
            if (child.type === 'atrule') {
              return callback(child, i)
            }
          })
        }
        if (name instanceof RegExp) {
          return this.walk((child, i) => {
            if (child.type === 'atrule' && name.test(child.name)) {
              return callback(child, i)
            }
          })
        }
        return this.walk((child, i) => {
          if (child.type === 'atrule' && child.name === name) {
            return callback(child, i)
          }
        })
      }

      walkComments(callback) {
        return this.walk((child, i) => {
          if (child.type === 'comment') {
            return callback(child, i)
          }
        })
      }

      append(...children) {
        for (let child of children) {
          let nodes = this.normalize(child, this.last);
          for (let node of nodes) this.proxyOf.nodes.push(node);
        }

        this.markDirty();

        return this
      }

      prepend(...children) {
        children = children.reverse();
        for (let child of children) {
          let nodes = this.normalize(child, this.first, 'prepend').reverse();
          for (let node of nodes) this.proxyOf.nodes.unshift(node);
          for (let id in this.indexes) {
            this.indexes[id] = this.indexes[id] + nodes.length;
          }
        }

        this.markDirty();

        return this
      }

      cleanRaws(keepBetween) {
        super.cleanRaws(keepBetween);
        if (this.nodes) {
          for (let node of this.nodes) node.cleanRaws(keepBetween);
        }
      }

      insertBefore(exist, add) {
        let existIndex = this.index(exist);
        let type = existIndex === 0 ? 'prepend' : false;
        let nodes = this.normalize(add, this.proxyOf.nodes[existIndex], type).reverse();
        existIndex = this.index(exist);
        for (let node of nodes) this.proxyOf.nodes.splice(existIndex, 0, node);

        let index;
        for (let id in this.indexes) {
          index = this.indexes[id];
          if (existIndex <= index) {
            this.indexes[id] = index + nodes.length;
          }
        }

        this.markDirty();

        return this
      }

      insertAfter(exist, add) {
        let existIndex = this.index(exist);
        let nodes = this.normalize(add, this.proxyOf.nodes[existIndex]).reverse();
        existIndex = this.index(exist);
        for (let node of nodes) this.proxyOf.nodes.splice(existIndex + 1, 0, node);

        let index;
        for (let id in this.indexes) {
          index = this.indexes[id];
          if (existIndex < index) {
            this.indexes[id] = index + nodes.length;
          }
        }

        this.markDirty();

        return this
      }

      removeChild(child) {
        child = this.index(child);
        this.proxyOf.nodes[child].parent = undefined;
        this.proxyOf.nodes.splice(child, 1);

        let index;
        for (let id in this.indexes) {
          index = this.indexes[id];
          if (index >= child) {
            this.indexes[id] = index - 1;
          }
        }

        this.markDirty();

        return this
      }

      removeAll() {
        for (let node of this.proxyOf.nodes) node.parent = undefined;
        this.proxyOf.nodes = [];

        this.markDirty();

        return this
      }

      replaceValues(pattern, opts, callback) {
        if (!callback) {
          callback = opts;
          opts = {};
        }

        this.walkDecls(decl => {
          if (opts.props && !opts.props.includes(decl.prop)) return
          if (opts.fast && !decl.value.includes(opts.fast)) return

          decl.value = decl.value.replace(pattern, callback);
        });

        this.markDirty();

        return this
      }

      every(condition) {
        return this.nodes.every(condition)
      }

      some(condition) {
        return this.nodes.some(condition)
      }

      index(child) {
        if (typeof child === 'number') return child
        if (child.proxyOf) child = child.proxyOf;
        return this.proxyOf.nodes.indexOf(child)
      }

      get first() {
        if (!this.proxyOf.nodes) return undefined
        return this.proxyOf.nodes[0]
      }

      get last() {
        if (!this.proxyOf.nodes) return undefined
        return this.proxyOf.nodes[this.proxyOf.nodes.length - 1]
      }

      normalize(nodes, sample) {
        if (typeof nodes === 'string') {
          nodes = cleanSource(parse$1(nodes).nodes);
        } else if (Array.isArray(nodes)) {
          nodes = nodes.slice(0);
          for (let i of nodes) {
            if (i.parent) i.parent.removeChild(i, 'ignore');
          }
        } else if (nodes.type === 'root' && this.type !== 'document') {
          nodes = nodes.nodes.slice(0);
          for (let i of nodes) {
            if (i.parent) i.parent.removeChild(i, 'ignore');
          }
        } else if (nodes.type) {
          nodes = [nodes];
        } else if (nodes.prop) {
          if (typeof nodes.value === 'undefined') {
            throw new Error('Value field is missed in node creation')
          } else if (typeof nodes.value !== 'string') {
            nodes.value = String(nodes.value);
          }
          nodes = [new declaration(nodes)];
        } else if (nodes.selector) {
          nodes = [new Rule$1(nodes)];
        } else if (nodes.name) {
          nodes = [new AtRule$1(nodes)];
        } else if (nodes.text) {
          nodes = [new comment(nodes)];
        } else {
          throw new Error('Unknown node type in node creation')
        }

        let processed = nodes.map(i => {
          /* c8 ignore next */
          if (!i[my$1]) Container.rebuild(i);
          i = i.proxyOf;
          if (i.parent) i.parent.removeChild(i);
          if (i[isClean$1]) markDirtyUp(i);
          if (typeof i.raws.before === 'undefined') {
            if (sample && typeof sample.raws.before !== 'undefined') {
              i.raws.before = sample.raws.before.replace(/\S/g, '');
            }
          }
          i.parent = this.proxyOf;
          return i
        });

        return processed
      }

      getProxyProcessor() {
        return {
          set(node, prop, value) {
            if (node[prop] === value) return true
            node[prop] = value;
            if (prop === 'name' || prop === 'params' || prop === 'selector') {
              node.markDirty();
            }
            return true
          },

          get(node, prop) {
            if (prop === 'proxyOf') {
              return node
            } else if (!node[prop]) {
              return node[prop]
            } else if (
              prop === 'each' ||
              (typeof prop === 'string' && prop.startsWith('walk'))
            ) {
              return (...args) => {
                return node[prop](
                  ...args.map(i => {
                    if (typeof i === 'function') {
                      return (child, index) => i(child.toProxy(), index)
                    } else {
                      return i
                    }
                  })
                )
              }
            } else if (prop === 'every' || prop === 'some') {
              return cb => {
                return node[prop]((child, ...other) =>
                  cb(child.toProxy(), ...other)
                )
              }
            } else if (prop === 'root') {
              return () => node.root().toProxy()
            } else if (prop === 'nodes') {
              return node.nodes.map(i => i.toProxy())
            } else if (prop === 'first' || prop === 'last') {
              return node[prop].toProxy()
            } else {
              return node[prop]
            }
          }
        }
      }

      getIterator() {
        if (!this.lastEach) this.lastEach = 0;
        if (!this.indexes) this.indexes = {};

        this.lastEach += 1;
        let iterator = this.lastEach;
        this.indexes[iterator] = 0;

        return iterator
      }
    }

    Container.registerParse = dependant => {
      parse$1 = dependant;
    };

    Container.registerRule = dependant => {
      Rule$1 = dependant;
    };

    Container.registerAtRule = dependant => {
      AtRule$1 = dependant;
    };

    Container.registerRoot = dependant => {
      Root$1 = dependant;
    };

    var container = Container;
    Container.default = Container;

    /* c8 ignore start */
    Container.rebuild = node => {
      if (node.type === 'atrule') {
        Object.setPrototypeOf(node, AtRule$1.prototype);
      } else if (node.type === 'rule') {
        Object.setPrototypeOf(node, Rule$1.prototype);
      } else if (node.type === 'decl') {
        Object.setPrototypeOf(node, declaration.prototype);
      } else if (node.type === 'comment') {
        Object.setPrototypeOf(node, comment.prototype);
      } else if (node.type === 'root') {
        Object.setPrototypeOf(node, Root$1.prototype);
      }

      node[my$1] = true;

      if (node.nodes) {
        node.nodes.forEach(child => {
          Container.rebuild(child);
        });
      }
    };

    let LazyResult$2, Processor$2;

    class Document extends container {
      constructor(defaults) {
        // type needs to be passed to super, otherwise child roots won't be normalized correctly
        super({ type: 'document', ...defaults });

        if (!this.nodes) {
          this.nodes = [];
        }
      }

      toResult(opts = {}) {
        let lazy = new LazyResult$2(new Processor$2(), this, opts);

        return lazy.stringify()
      }
    }

    Document.registerLazyResult = dependant => {
      LazyResult$2 = dependant;
    };

    Document.registerProcessor = dependant => {
      Processor$2 = dependant;
    };

    var document$1 = Document;
    Document.default = Document;

    /* eslint-disable no-console */

    let printed = {};

    var warnOnce = function warnOnce(message) {
      if (printed[message]) return
      printed[message] = true;

      if (typeof console !== 'undefined' && console.warn) {
        console.warn(message);
      }
    };

    class Warning {
      constructor(text, opts = {}) {
        this.type = 'warning';
        this.text = text;

        if (opts.node && opts.node.source) {
          let range = opts.node.rangeBy(opts);
          this.line = range.start.line;
          this.column = range.start.column;
          this.endLine = range.end.line;
          this.endColumn = range.end.column;
        }

        for (let opt in opts) this[opt] = opts[opt];
      }

      toString() {
        if (this.node) {
          return this.node.error(this.text, {
            plugin: this.plugin,
            index: this.index,
            word: this.word
          }).message
        }

        if (this.plugin) {
          return this.plugin + ': ' + this.text
        }

        return this.text
      }
    }

    var warning = Warning;
    Warning.default = Warning;

    class Result {
      constructor(processor, root, opts) {
        this.processor = processor;
        this.messages = [];
        this.root = root;
        this.opts = opts;
        this.css = undefined;
        this.map = undefined;
      }

      toString() {
        return this.css
      }

      warn(text, opts = {}) {
        if (!opts.plugin) {
          if (this.lastPlugin && this.lastPlugin.postcssPlugin) {
            opts.plugin = this.lastPlugin.postcssPlugin;
          }
        }

        let warning$1 = new warning(text, opts);
        this.messages.push(warning$1);

        return warning$1
      }

      warnings() {
        return this.messages.filter(i => i.type === 'warning')
      }

      get content() {
        return this.css
      }
    }

    var result = Result;
    Result.default = Result;

    const SINGLE_QUOTE = "'".charCodeAt(0);
    const DOUBLE_QUOTE = '"'.charCodeAt(0);
    const BACKSLASH = '\\'.charCodeAt(0);
    const SLASH = '/'.charCodeAt(0);
    const NEWLINE = '\n'.charCodeAt(0);
    const SPACE = ' '.charCodeAt(0);
    const FEED = '\f'.charCodeAt(0);
    const TAB = '\t'.charCodeAt(0);
    const CR = '\r'.charCodeAt(0);
    const OPEN_SQUARE = '['.charCodeAt(0);
    const CLOSE_SQUARE = ']'.charCodeAt(0);
    const OPEN_PARENTHESES = '('.charCodeAt(0);
    const CLOSE_PARENTHESES = ')'.charCodeAt(0);
    const OPEN_CURLY = '{'.charCodeAt(0);
    const CLOSE_CURLY = '}'.charCodeAt(0);
    const SEMICOLON = ';'.charCodeAt(0);
    const ASTERISK = '*'.charCodeAt(0);
    const COLON = ':'.charCodeAt(0);
    const AT = '@'.charCodeAt(0);

    const RE_AT_END = /[\t\n\f\r "#'()/;[\\\]{}]/g;
    const RE_WORD_END = /[\t\n\f\r !"#'():;@[\\\]{}]|\/(?=\*)/g;
    const RE_BAD_BRACKET = /.[\n"'(/\\]/;
    const RE_HEX_ESCAPE = /[\da-f]/i;

    var tokenize = function tokenizer(input, options = {}) {
      let css = input.css.valueOf();
      let ignore = options.ignoreErrors;

      let code, next, quote, content, escape;
      let escaped, escapePos, prev, n, currentToken;

      let length = css.length;
      let pos = 0;
      let buffer = [];
      let returned = [];

      function position() {
        return pos
      }

      function unclosed(what) {
        throw input.error('Unclosed ' + what, pos)
      }

      function endOfFile() {
        return returned.length === 0 && pos >= length
      }

      function nextToken(opts) {
        if (returned.length) return returned.pop()
        if (pos >= length) return

        let ignoreUnclosed = opts ? opts.ignoreUnclosed : false;

        code = css.charCodeAt(pos);

        switch (code) {
          case NEWLINE:
          case SPACE:
          case TAB:
          case CR:
          case FEED: {
            next = pos;
            do {
              next += 1;
              code = css.charCodeAt(next);
            } while (
              code === SPACE ||
              code === NEWLINE ||
              code === TAB ||
              code === CR ||
              code === FEED
            )

            currentToken = ['space', css.slice(pos, next)];
            pos = next - 1;
            break
          }

          case OPEN_SQUARE:
          case CLOSE_SQUARE:
          case OPEN_CURLY:
          case CLOSE_CURLY:
          case COLON:
          case SEMICOLON:
          case CLOSE_PARENTHESES: {
            let controlChar = String.fromCharCode(code);
            currentToken = [controlChar, controlChar, pos];
            break
          }

          case OPEN_PARENTHESES: {
            prev = buffer.length ? buffer.pop()[1] : '';
            n = css.charCodeAt(pos + 1);
            if (
              prev === 'url' &&
              n !== SINGLE_QUOTE &&
              n !== DOUBLE_QUOTE &&
              n !== SPACE &&
              n !== NEWLINE &&
              n !== TAB &&
              n !== FEED &&
              n !== CR
            ) {
              next = pos;
              do {
                escaped = false;
                next = css.indexOf(')', next + 1);
                if (next === -1) {
                  if (ignore || ignoreUnclosed) {
                    next = pos;
                    break
                  } else {
                    unclosed('bracket');
                  }
                }
                escapePos = next;
                while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                  escapePos -= 1;
                  escaped = !escaped;
                }
              } while (escaped)

              currentToken = ['brackets', css.slice(pos, next + 1), pos, next];

              pos = next;
            } else {
              next = css.indexOf(')', pos + 1);
              content = css.slice(pos, next + 1);

              if (next === -1 || RE_BAD_BRACKET.test(content)) {
                currentToken = ['(', '(', pos];
              } else {
                currentToken = ['brackets', content, pos, next];
                pos = next;
              }
            }

            break
          }

          case SINGLE_QUOTE:
          case DOUBLE_QUOTE: {
            quote = code === SINGLE_QUOTE ? "'" : '"';
            next = pos;
            do {
              escaped = false;
              next = css.indexOf(quote, next + 1);
              if (next === -1) {
                if (ignore || ignoreUnclosed) {
                  next = pos + 1;
                  break
                } else {
                  unclosed('string');
                }
              }
              escapePos = next;
              while (css.charCodeAt(escapePos - 1) === BACKSLASH) {
                escapePos -= 1;
                escaped = !escaped;
              }
            } while (escaped)

            currentToken = ['string', css.slice(pos, next + 1), pos, next];
            pos = next;
            break
          }

          case AT: {
            RE_AT_END.lastIndex = pos + 1;
            RE_AT_END.test(css);
            if (RE_AT_END.lastIndex === 0) {
              next = css.length - 1;
            } else {
              next = RE_AT_END.lastIndex - 2;
            }

            currentToken = ['at-word', css.slice(pos, next + 1), pos, next];

            pos = next;
            break
          }

          case BACKSLASH: {
            next = pos;
            escape = true;
            while (css.charCodeAt(next + 1) === BACKSLASH) {
              next += 1;
              escape = !escape;
            }
            code = css.charCodeAt(next + 1);
            if (
              escape &&
              code !== SLASH &&
              code !== SPACE &&
              code !== NEWLINE &&
              code !== TAB &&
              code !== CR &&
              code !== FEED
            ) {
              next += 1;
              if (RE_HEX_ESCAPE.test(css.charAt(next))) {
                while (RE_HEX_ESCAPE.test(css.charAt(next + 1))) {
                  next += 1;
                }
                if (css.charCodeAt(next + 1) === SPACE) {
                  next += 1;
                }
              }
            }

            currentToken = ['word', css.slice(pos, next + 1), pos, next];

            pos = next;
            break
          }

          default: {
            if (code === SLASH && css.charCodeAt(pos + 1) === ASTERISK) {
              next = css.indexOf('*/', pos + 2) + 1;
              if (next === 0) {
                if (ignore || ignoreUnclosed) {
                  next = css.length;
                } else {
                  unclosed('comment');
                }
              }

              currentToken = ['comment', css.slice(pos, next + 1), pos, next];
              pos = next;
            } else {
              RE_WORD_END.lastIndex = pos + 1;
              RE_WORD_END.test(css);
              if (RE_WORD_END.lastIndex === 0) {
                next = css.length - 1;
              } else {
                next = RE_WORD_END.lastIndex - 2;
              }

              currentToken = ['word', css.slice(pos, next + 1), pos, next];
              buffer.push(currentToken);
              pos = next;
            }

            break
          }
        }

        pos++;
        return currentToken
      }

      function back(token) {
        returned.push(token);
      }

      return {
        back,
        nextToken,
        endOfFile,
        position
      }
    };

    class AtRule extends container {
      constructor(defaults) {
        super(defaults);
        this.type = 'atrule';
      }

      append(...children) {
        if (!this.proxyOf.nodes) this.nodes = [];
        return super.append(...children)
      }

      prepend(...children) {
        if (!this.proxyOf.nodes) this.nodes = [];
        return super.prepend(...children)
      }
    }

    var atRule = AtRule;
    AtRule.default = AtRule;

    container.registerAtRule(AtRule);

    let LazyResult$1, Processor$1;

    class Root extends container {
      constructor(defaults) {
        super(defaults);
        this.type = 'root';
        if (!this.nodes) this.nodes = [];
      }

      removeChild(child, ignore) {
        let index = this.index(child);

        if (!ignore && index === 0 && this.nodes.length > 1) {
          this.nodes[1].raws.before = this.nodes[index].raws.before;
        }

        return super.removeChild(child)
      }

      normalize(child, sample, type) {
        let nodes = super.normalize(child);

        if (sample) {
          if (type === 'prepend') {
            if (this.nodes.length > 1) {
              sample.raws.before = this.nodes[1].raws.before;
            } else {
              delete sample.raws.before;
            }
          } else if (this.first !== sample) {
            for (let node of nodes) {
              node.raws.before = sample.raws.before;
            }
          }
        }

        return nodes
      }

      toResult(opts = {}) {
        let lazy = new LazyResult$1(new Processor$1(), this, opts);
        return lazy.stringify()
      }
    }

    Root.registerLazyResult = dependant => {
      LazyResult$1 = dependant;
    };

    Root.registerProcessor = dependant => {
      Processor$1 = dependant;
    };

    var root = Root;
    Root.default = Root;

    container.registerRoot(Root);

    let list = {
      split(string, separators, last) {
        let array = [];
        let current = '';
        let split = false;

        let func = 0;
        let inQuote = false;
        let prevQuote = '';
        let escape = false;

        for (let letter of string) {
          if (escape) {
            escape = false;
          } else if (letter === '\\') {
            escape = true;
          } else if (inQuote) {
            if (letter === prevQuote) {
              inQuote = false;
            }
          } else if (letter === '"' || letter === "'") {
            inQuote = true;
            prevQuote = letter;
          } else if (letter === '(') {
            func += 1;
          } else if (letter === ')') {
            if (func > 0) func -= 1;
          } else if (func === 0) {
            if (separators.includes(letter)) split = true;
          }

          if (split) {
            if (current !== '') array.push(current.trim());
            current = '';
            split = false;
          } else {
            current += letter;
          }
        }

        if (last || current !== '') array.push(current.trim());
        return array
      },

      space(string) {
        let spaces = [' ', '\n', '\t'];
        return list.split(string, spaces)
      },

      comma(string) {
        return list.split(string, [','], true)
      }
    };

    var list_1 = list;
    list.default = list;

    class Rule extends container {
      constructor(defaults) {
        super(defaults);
        this.type = 'rule';
        if (!this.nodes) this.nodes = [];
      }

      get selectors() {
        return list_1.comma(this.selector)
      }

      set selectors(values) {
        let match = this.selector ? this.selector.match(/,\s*/) : null;
        let sep = match ? match[0] : ',' + this.raw('between', 'beforeOpen');
        this.selector = values.join(sep);
      }
    }

    var rule = Rule;
    Rule.default = Rule;

    container.registerRule(Rule);

    const SAFE_COMMENT_NEIGHBOR = {
      empty: true,
      space: true
    };

    function findLastWithPosition(tokens) {
      for (let i = tokens.length - 1; i >= 0; i--) {
        let token = tokens[i];
        let pos = token[3] || token[2];
        if (pos) return pos
      }
    }

    class Parser {
      constructor(input) {
        this.input = input;

        this.root = new root();
        this.current = this.root;
        this.spaces = '';
        this.semicolon = false;
        this.customProperty = false;

        this.createTokenizer();
        this.root.source = { input, start: { offset: 0, line: 1, column: 1 } };
      }

      createTokenizer() {
        this.tokenizer = tokenize(this.input);
      }

      parse() {
        let token;
        while (!this.tokenizer.endOfFile()) {
          token = this.tokenizer.nextToken();

          switch (token[0]) {
            case 'space':
              this.spaces += token[1];
              break

            case ';':
              this.freeSemicolon(token);
              break

            case '}':
              this.end(token);
              break

            case 'comment':
              this.comment(token);
              break

            case 'at-word':
              this.atrule(token);
              break

            case '{':
              this.emptyRule(token);
              break

            default:
              this.other(token);
              break
          }
        }
        this.endFile();
      }

      comment(token) {
        let node = new comment();
        this.init(node, token[2]);
        node.source.end = this.getPosition(token[3] || token[2]);

        let text = token[1].slice(2, -2);
        if (/^\s*$/.test(text)) {
          node.text = '';
          node.raws.left = text;
          node.raws.right = '';
        } else {
          let match = text.match(/^(\s*)([^]*\S)(\s*)$/);
          node.text = match[2];
          node.raws.left = match[1];
          node.raws.right = match[3];
        }
      }

      emptyRule(token) {
        let node = new rule();
        this.init(node, token[2]);
        node.selector = '';
        node.raws.between = '';
        this.current = node;
      }

      other(start) {
        let end = false;
        let type = null;
        let colon = false;
        let bracket = null;
        let brackets = [];
        let customProperty = start[1].startsWith('--');

        let tokens = [];
        let token = start;
        while (token) {
          type = token[0];
          tokens.push(token);

          if (type === '(' || type === '[') {
            if (!bracket) bracket = token;
            brackets.push(type === '(' ? ')' : ']');
          } else if (customProperty && colon && type === '{') {
            if (!bracket) bracket = token;
            brackets.push('}');
          } else if (brackets.length === 0) {
            if (type === ';') {
              if (colon) {
                this.decl(tokens, customProperty);
                return
              } else {
                break
              }
            } else if (type === '{') {
              this.rule(tokens);
              return
            } else if (type === '}') {
              this.tokenizer.back(tokens.pop());
              end = true;
              break
            } else if (type === ':') {
              colon = true;
            }
          } else if (type === brackets[brackets.length - 1]) {
            brackets.pop();
            if (brackets.length === 0) bracket = null;
          }

          token = this.tokenizer.nextToken();
        }

        if (this.tokenizer.endOfFile()) end = true;
        if (brackets.length > 0) this.unclosedBracket(bracket);

        if (end && colon) {
          if (!customProperty) {
            while (tokens.length) {
              token = tokens[tokens.length - 1][0];
              if (token !== 'space' && token !== 'comment') break
              this.tokenizer.back(tokens.pop());
            }
          }
          this.decl(tokens, customProperty);
        } else {
          this.unknownWord(tokens);
        }
      }

      rule(tokens) {
        tokens.pop();

        let node = new rule();
        this.init(node, tokens[0][2]);

        node.raws.between = this.spacesAndCommentsFromEnd(tokens);
        this.raw(node, 'selector', tokens);
        this.current = node;
      }

      decl(tokens, customProperty) {
        let node = new declaration();
        this.init(node, tokens[0][2]);

        let last = tokens[tokens.length - 1];
        if (last[0] === ';') {
          this.semicolon = true;
          tokens.pop();
        }

        node.source.end = this.getPosition(
          last[3] || last[2] || findLastWithPosition(tokens)
        );

        while (tokens[0][0] !== 'word') {
          if (tokens.length === 1) this.unknownWord(tokens);
          node.raws.before += tokens.shift()[1];
        }
        node.source.start = this.getPosition(tokens[0][2]);

        node.prop = '';
        while (tokens.length) {
          let type = tokens[0][0];
          if (type === ':' || type === 'space' || type === 'comment') {
            break
          }
          node.prop += tokens.shift()[1];
        }

        node.raws.between = '';

        let token;
        while (tokens.length) {
          token = tokens.shift();

          if (token[0] === ':') {
            node.raws.between += token[1];
            break
          } else {
            if (token[0] === 'word' && /\w/.test(token[1])) {
              this.unknownWord([token]);
            }
            node.raws.between += token[1];
          }
        }

        if (node.prop[0] === '_' || node.prop[0] === '*') {
          node.raws.before += node.prop[0];
          node.prop = node.prop.slice(1);
        }

        let firstSpaces = [];
        let next;
        while (tokens.length) {
          next = tokens[0][0];
          if (next !== 'space' && next !== 'comment') break
          firstSpaces.push(tokens.shift());
        }

        this.precheckMissedSemicolon(tokens);

        for (let i = tokens.length - 1; i >= 0; i--) {
          token = tokens[i];
          if (token[1].toLowerCase() === '!important') {
            node.important = true;
            let string = this.stringFrom(tokens, i);
            string = this.spacesFromEnd(tokens) + string;
            if (string !== ' !important') node.raws.important = string;
            break
          } else if (token[1].toLowerCase() === 'important') {
            let cache = tokens.slice(0);
            let str = '';
            for (let j = i; j > 0; j--) {
              let type = cache[j][0];
              if (str.trim().indexOf('!') === 0 && type !== 'space') {
                break
              }
              str = cache.pop()[1] + str;
            }
            if (str.trim().indexOf('!') === 0) {
              node.important = true;
              node.raws.important = str;
              tokens = cache;
            }
          }

          if (token[0] !== 'space' && token[0] !== 'comment') {
            break
          }
        }

        let hasWord = tokens.some(i => i[0] !== 'space' && i[0] !== 'comment');

        if (hasWord) {
          node.raws.between += firstSpaces.map(i => i[1]).join('');
          firstSpaces = [];
        }
        this.raw(node, 'value', firstSpaces.concat(tokens), customProperty);

        if (node.value.includes(':') && !customProperty) {
          this.checkMissedSemicolon(tokens);
        }
      }

      atrule(token) {
        let node = new atRule();
        node.name = token[1].slice(1);
        if (node.name === '') {
          this.unnamedAtrule(node, token);
        }
        this.init(node, token[2]);

        let type;
        let prev;
        let shift;
        let last = false;
        let open = false;
        let params = [];
        let brackets = [];

        while (!this.tokenizer.endOfFile()) {
          token = this.tokenizer.nextToken();
          type = token[0];

          if (type === '(' || type === '[') {
            brackets.push(type === '(' ? ')' : ']');
          } else if (type === '{' && brackets.length > 0) {
            brackets.push('}');
          } else if (type === brackets[brackets.length - 1]) {
            brackets.pop();
          }

          if (brackets.length === 0) {
            if (type === ';') {
              node.source.end = this.getPosition(token[2]);
              this.semicolon = true;
              break
            } else if (type === '{') {
              open = true;
              break
            } else if (type === '}') {
              if (params.length > 0) {
                shift = params.length - 1;
                prev = params[shift];
                while (prev && prev[0] === 'space') {
                  prev = params[--shift];
                }
                if (prev) {
                  node.source.end = this.getPosition(prev[3] || prev[2]);
                }
              }
              this.end(token);
              break
            } else {
              params.push(token);
            }
          } else {
            params.push(token);
          }

          if (this.tokenizer.endOfFile()) {
            last = true;
            break
          }
        }

        node.raws.between = this.spacesAndCommentsFromEnd(params);
        if (params.length) {
          node.raws.afterName = this.spacesAndCommentsFromStart(params);
          this.raw(node, 'params', params);
          if (last) {
            token = params[params.length - 1];
            node.source.end = this.getPosition(token[3] || token[2]);
            this.spaces = node.raws.between;
            node.raws.between = '';
          }
        } else {
          node.raws.afterName = '';
          node.params = '';
        }

        if (open) {
          node.nodes = [];
          this.current = node;
        }
      }

      end(token) {
        if (this.current.nodes && this.current.nodes.length) {
          this.current.raws.semicolon = this.semicolon;
        }
        this.semicolon = false;

        this.current.raws.after = (this.current.raws.after || '') + this.spaces;
        this.spaces = '';

        if (this.current.parent) {
          this.current.source.end = this.getPosition(token[2]);
          this.current = this.current.parent;
        } else {
          this.unexpectedClose(token);
        }
      }

      endFile() {
        if (this.current.parent) this.unclosedBlock();
        if (this.current.nodes && this.current.nodes.length) {
          this.current.raws.semicolon = this.semicolon;
        }
        this.current.raws.after = (this.current.raws.after || '') + this.spaces;
      }

      freeSemicolon(token) {
        this.spaces += token[1];
        if (this.current.nodes) {
          let prev = this.current.nodes[this.current.nodes.length - 1];
          if (prev && prev.type === 'rule' && !prev.raws.ownSemicolon) {
            prev.raws.ownSemicolon = this.spaces;
            this.spaces = '';
          }
        }
      }

      // Helpers

      getPosition(offset) {
        let pos = this.input.fromOffset(offset);
        return {
          offset,
          line: pos.line,
          column: pos.col
        }
      }

      init(node, offset) {
        this.current.push(node);
        node.source = {
          start: this.getPosition(offset),
          input: this.input
        };
        node.raws.before = this.spaces;
        this.spaces = '';
        if (node.type !== 'comment') this.semicolon = false;
      }

      raw(node, prop, tokens, customProperty) {
        let token, type;
        let length = tokens.length;
        let value = '';
        let clean = true;
        let next, prev;

        for (let i = 0; i < length; i += 1) {
          token = tokens[i];
          type = token[0];
          if (type === 'space' && i === length - 1 && !customProperty) {
            clean = false;
          } else if (type === 'comment') {
            prev = tokens[i - 1] ? tokens[i - 1][0] : 'empty';
            next = tokens[i + 1] ? tokens[i + 1][0] : 'empty';
            if (!SAFE_COMMENT_NEIGHBOR[prev] && !SAFE_COMMENT_NEIGHBOR[next]) {
              if (value.slice(-1) === ',') {
                clean = false;
              } else {
                value += token[1];
              }
            } else {
              clean = false;
            }
          } else {
            value += token[1];
          }
        }
        if (!clean) {
          let raw = tokens.reduce((all, i) => all + i[1], '');
          node.raws[prop] = { value, raw };
        }
        node[prop] = value;
      }

      spacesAndCommentsFromEnd(tokens) {
        let lastTokenType;
        let spaces = '';
        while (tokens.length) {
          lastTokenType = tokens[tokens.length - 1][0];
          if (lastTokenType !== 'space' && lastTokenType !== 'comment') break
          spaces = tokens.pop()[1] + spaces;
        }
        return spaces
      }

      spacesAndCommentsFromStart(tokens) {
        let next;
        let spaces = '';
        while (tokens.length) {
          next = tokens[0][0];
          if (next !== 'space' && next !== 'comment') break
          spaces += tokens.shift()[1];
        }
        return spaces
      }

      spacesFromEnd(tokens) {
        let lastTokenType;
        let spaces = '';
        while (tokens.length) {
          lastTokenType = tokens[tokens.length - 1][0];
          if (lastTokenType !== 'space') break
          spaces = tokens.pop()[1] + spaces;
        }
        return spaces
      }

      stringFrom(tokens, from) {
        let result = '';
        for (let i = from; i < tokens.length; i++) {
          result += tokens[i][1];
        }
        tokens.splice(from, tokens.length - from);
        return result
      }

      colon(tokens) {
        let brackets = 0;
        let token, type, prev;
        for (let [i, element] of tokens.entries()) {
          token = element;
          type = token[0];

          if (type === '(') {
            brackets += 1;
          }
          if (type === ')') {
            brackets -= 1;
          }
          if (brackets === 0 && type === ':') {
            if (!prev) {
              this.doubleColon(token);
            } else if (prev[0] === 'word' && prev[1] === 'progid') {
              continue
            } else {
              return i
            }
          }

          prev = token;
        }
        return false
      }

      // Errors

      unclosedBracket(bracket) {
        throw this.input.error(
          'Unclosed bracket',
          { offset: bracket[2] },
          { offset: bracket[2] + 1 }
        )
      }

      unknownWord(tokens) {
        throw this.input.error(
          'Unknown word',
          { offset: tokens[0][2] },
          { offset: tokens[0][2] + tokens[0][1].length }
        )
      }

      unexpectedClose(token) {
        throw this.input.error(
          'Unexpected }',
          { offset: token[2] },
          { offset: token[2] + 1 }
        )
      }

      unclosedBlock() {
        let pos = this.current.source.start;
        throw this.input.error('Unclosed block', pos.line, pos.column)
      }

      doubleColon(token) {
        throw this.input.error(
          'Double colon',
          { offset: token[2] },
          { offset: token[2] + token[1].length }
        )
      }

      unnamedAtrule(node, token) {
        throw this.input.error(
          'At-rule without name',
          { offset: token[2] },
          { offset: token[2] + token[1].length }
        )
      }

      precheckMissedSemicolon(/* tokens */) {
        // Hook for Safe Parser
      }

      checkMissedSemicolon(tokens) {
        let colon = this.colon(tokens);
        if (colon === false) return

        let founded = 0;
        let token;
        for (let j = colon - 1; j >= 0; j--) {
          token = tokens[j];
          if (token[0] !== 'space') {
            founded += 1;
            if (founded === 2) break
          }
        }
        // If the token is a word, e.g. `!important`, `red` or any other valid property's value.
        // Then we need to return the colon after that word token. [3] is the "end" colon of that word.
        // And because we need it after that one we do +1 to get the next one.
        throw this.input.error(
          'Missed semicolon',
          token[0] === 'word' ? token[3] + 1 : token[2]
        )
      }
    }

    var parser = Parser;

    function parse(css, opts) {
      let input$1 = new input(css, opts);
      let parser$1 = new parser(input$1);
      try {
        parser$1.parse();
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          if (e.name === 'CssSyntaxError' && opts && opts.from) {
            if (/\.scss$/i.test(opts.from)) {
              e.message +=
                '\nYou tried to parse SCSS with ' +
                'the standard CSS parser; ' +
                'try again with the postcss-scss parser';
            } else if (/\.sass/i.test(opts.from)) {
              e.message +=
                '\nYou tried to parse Sass with ' +
                'the standard CSS parser; ' +
                'try again with the postcss-sass parser';
            } else if (/\.less$/i.test(opts.from)) {
              e.message +=
                '\nYou tried to parse Less with ' +
                'the standard CSS parser; ' +
                'try again with the postcss-less parser';
            }
          }
        }
        throw e
      }

      return parser$1.root
    }

    var parse_1 = parse;
    parse.default = parse;

    container.registerParse(parse);

    let { isClean, my } = symbols;









    const TYPE_TO_CLASS_NAME = {
      document: 'Document',
      root: 'Root',
      atrule: 'AtRule',
      rule: 'Rule',
      decl: 'Declaration',
      comment: 'Comment'
    };

    const PLUGIN_PROPS = {
      postcssPlugin: true,
      prepare: true,
      Once: true,
      Document: true,
      Root: true,
      Declaration: true,
      Rule: true,
      AtRule: true,
      Comment: true,
      DeclarationExit: true,
      RuleExit: true,
      AtRuleExit: true,
      CommentExit: true,
      RootExit: true,
      DocumentExit: true,
      OnceExit: true
    };

    const NOT_VISITORS = {
      postcssPlugin: true,
      prepare: true,
      Once: true
    };

    const CHILDREN = 0;

    function isPromise(obj) {
      return typeof obj === 'object' && typeof obj.then === 'function'
    }

    function getEvents(node) {
      let key = false;
      let type = TYPE_TO_CLASS_NAME[node.type];
      if (node.type === 'decl') {
        key = node.prop.toLowerCase();
      } else if (node.type === 'atrule') {
        key = node.name.toLowerCase();
      }

      if (key && node.append) {
        return [
          type,
          type + '-' + key,
          CHILDREN,
          type + 'Exit',
          type + 'Exit-' + key
        ]
      } else if (key) {
        return [type, type + '-' + key, type + 'Exit', type + 'Exit-' + key]
      } else if (node.append) {
        return [type, CHILDREN, type + 'Exit']
      } else {
        return [type, type + 'Exit']
      }
    }

    function toStack(node) {
      let events;
      if (node.type === 'document') {
        events = ['Document', CHILDREN, 'DocumentExit'];
      } else if (node.type === 'root') {
        events = ['Root', CHILDREN, 'RootExit'];
      } else {
        events = getEvents(node);
      }

      return {
        node,
        events,
        eventIndex: 0,
        visitors: [],
        visitorIndex: 0,
        iterator: 0
      }
    }

    function cleanMarks(node) {
      node[isClean] = false;
      if (node.nodes) node.nodes.forEach(i => cleanMarks(i));
      return node
    }

    let postcss$1 = {};

    class LazyResult {
      constructor(processor, css, opts) {
        this.stringified = false;
        this.processed = false;

        let root;
        if (
          typeof css === 'object' &&
          css !== null &&
          (css.type === 'root' || css.type === 'document')
        ) {
          root = cleanMarks(css);
        } else if (css instanceof LazyResult || css instanceof result) {
          root = cleanMarks(css.root);
          if (css.map) {
            if (typeof opts.map === 'undefined') opts.map = {};
            if (!opts.map.inline) opts.map.inline = false;
            opts.map.prev = css.map;
          }
        } else {
          let parser = parse_1;
          if (opts.syntax) parser = opts.syntax.parse;
          if (opts.parser) parser = opts.parser;
          if (parser.parse) parser = parser.parse;

          try {
            root = parser(css, opts);
          } catch (error) {
            this.processed = true;
            this.error = error;
          }

          if (root && !root[my]) {
            /* c8 ignore next 2 */
            container.rebuild(root);
          }
        }

        this.result = new result(processor, root, opts);
        this.helpers = { ...postcss$1, result: this.result, postcss: postcss$1 };
        this.plugins = this.processor.plugins.map(plugin => {
          if (typeof plugin === 'object' && plugin.prepare) {
            return { ...plugin, ...plugin.prepare(this.result) }
          } else {
            return plugin
          }
        });
      }

      get [Symbol.toStringTag]() {
        return 'LazyResult'
      }

      get processor() {
        return this.result.processor
      }

      get opts() {
        return this.result.opts
      }

      get css() {
        return this.stringify().css
      }

      get content() {
        return this.stringify().content
      }

      get map() {
        return this.stringify().map
      }

      get root() {
        return this.sync().root
      }

      get messages() {
        return this.sync().messages
      }

      warnings() {
        return this.sync().warnings()
      }

      toString() {
        return this.css
      }

      then(onFulfilled, onRejected) {
        if (process.env.NODE_ENV !== 'production') {
          if (!('from' in this.opts)) {
            warnOnce(
              'Without `from` option PostCSS could generate wrong source map ' +
                'and will not find Browserslist config. Set it to CSS file path ' +
                'or to `undefined` to prevent this warning.'
            );
          }
        }
        return this.async().then(onFulfilled, onRejected)
      }

      catch(onRejected) {
        return this.async().catch(onRejected)
      }

      finally(onFinally) {
        return this.async().then(onFinally, onFinally)
      }

      async() {
        if (this.error) return Promise.reject(this.error)
        if (this.processed) return Promise.resolve(this.result)
        if (!this.processing) {
          this.processing = this.runAsync();
        }
        return this.processing
      }

      sync() {
        if (this.error) throw this.error
        if (this.processed) return this.result
        this.processed = true;

        if (this.processing) {
          throw this.getAsyncError()
        }

        for (let plugin of this.plugins) {
          let promise = this.runOnRoot(plugin);
          if (isPromise(promise)) {
            throw this.getAsyncError()
          }
        }

        this.prepareVisitors();
        if (this.hasListener) {
          let root = this.result.root;
          while (!root[isClean]) {
            root[isClean] = true;
            this.walkSync(root);
          }
          if (this.listeners.OnceExit) {
            if (root.type === 'document') {
              for (let subRoot of root.nodes) {
                this.visitSync(this.listeners.OnceExit, subRoot);
              }
            } else {
              this.visitSync(this.listeners.OnceExit, root);
            }
          }
        }

        return this.result
      }

      stringify() {
        if (this.error) throw this.error
        if (this.stringified) return this.result
        this.stringified = true;

        this.sync();

        let opts = this.result.opts;
        let str = stringify_1;
        if (opts.syntax) str = opts.syntax.stringify;
        if (opts.stringifier) str = opts.stringifier;
        if (str.stringify) str = str.stringify;

        let map = new mapGenerator(str, this.result.root, this.result.opts);
        let data = map.generate();
        this.result.css = data[0];
        this.result.map = data[1];

        return this.result
      }

      walkSync(node) {
        node[isClean] = true;
        let events = getEvents(node);
        for (let event of events) {
          if (event === CHILDREN) {
            if (node.nodes) {
              node.each(child => {
                if (!child[isClean]) this.walkSync(child);
              });
            }
          } else {
            let visitors = this.listeners[event];
            if (visitors) {
              if (this.visitSync(visitors, node.toProxy())) return
            }
          }
        }
      }

      visitSync(visitors, node) {
        for (let [plugin, visitor] of visitors) {
          this.result.lastPlugin = plugin;
          let promise;
          try {
            promise = visitor(node, this.helpers);
          } catch (e) {
            throw this.handleError(e, node.proxyOf)
          }
          if (node.type !== 'root' && node.type !== 'document' && !node.parent) {
            return true
          }
          if (isPromise(promise)) {
            throw this.getAsyncError()
          }
        }
      }

      runOnRoot(plugin) {
        this.result.lastPlugin = plugin;
        try {
          if (typeof plugin === 'object' && plugin.Once) {
            if (this.result.root.type === 'document') {
              let roots = this.result.root.nodes.map(root =>
                plugin.Once(root, this.helpers)
              );

              if (isPromise(roots[0])) {
                return Promise.all(roots)
              }

              return roots
            }

            return plugin.Once(this.result.root, this.helpers)
          } else if (typeof plugin === 'function') {
            return plugin(this.result.root, this.result)
          }
        } catch (error) {
          throw this.handleError(error)
        }
      }

      getAsyncError() {
        throw new Error('Use process(css).then(cb) to work with async plugins')
      }

      handleError(error, node) {
        let plugin = this.result.lastPlugin;
        try {
          if (node) node.addToError(error);
          this.error = error;
          if (error.name === 'CssSyntaxError' && !error.plugin) {
            error.plugin = plugin.postcssPlugin;
            error.setMessage();
          } else if (plugin.postcssVersion) {
            if (process.env.NODE_ENV !== 'production') {
              let pluginName = plugin.postcssPlugin;
              let pluginVer = plugin.postcssVersion;
              let runtimeVer = this.result.processor.version;
              let a = pluginVer.split('.');
              let b = runtimeVer.split('.');

              if (a[0] !== b[0] || parseInt(a[1]) > parseInt(b[1])) {
                // eslint-disable-next-line no-console
                console.error(
                  'Unknown error from PostCSS plugin. Your current PostCSS ' +
                    'version is ' +
                    runtimeVer +
                    ', but ' +
                    pluginName +
                    ' uses ' +
                    pluginVer +
                    '. Perhaps this is the source of the error below.'
                );
              }
            }
          }
        } catch (err) {
          /* c8 ignore next 3 */
          // eslint-disable-next-line no-console
          if (console && console.error) console.error(err);
        }
        return error
      }

      async runAsync() {
        this.plugin = 0;
        for (let i = 0; i < this.plugins.length; i++) {
          let plugin = this.plugins[i];
          let promise = this.runOnRoot(plugin);
          if (isPromise(promise)) {
            try {
              await promise;
            } catch (error) {
              throw this.handleError(error)
            }
          }
        }

        this.prepareVisitors();
        if (this.hasListener) {
          let root = this.result.root;
          while (!root[isClean]) {
            root[isClean] = true;
            let stack = [toStack(root)];
            while (stack.length > 0) {
              let promise = this.visitTick(stack);
              if (isPromise(promise)) {
                try {
                  await promise;
                } catch (e) {
                  let node = stack[stack.length - 1].node;
                  throw this.handleError(e, node)
                }
              }
            }
          }

          if (this.listeners.OnceExit) {
            for (let [plugin, visitor] of this.listeners.OnceExit) {
              this.result.lastPlugin = plugin;
              try {
                if (root.type === 'document') {
                  let roots = root.nodes.map(subRoot =>
                    visitor(subRoot, this.helpers)
                  );

                  await Promise.all(roots);
                } else {
                  await visitor(root, this.helpers);
                }
              } catch (e) {
                throw this.handleError(e)
              }
            }
          }
        }

        this.processed = true;
        return this.stringify()
      }

      prepareVisitors() {
        this.listeners = {};
        let add = (plugin, type, cb) => {
          if (!this.listeners[type]) this.listeners[type] = [];
          this.listeners[type].push([plugin, cb]);
        };
        for (let plugin of this.plugins) {
          if (typeof plugin === 'object') {
            for (let event in plugin) {
              if (!PLUGIN_PROPS[event] && /^[A-Z]/.test(event)) {
                throw new Error(
                  `Unknown event ${event} in ${plugin.postcssPlugin}. ` +
                    `Try to update PostCSS (${this.processor.version} now).`
                )
              }
              if (!NOT_VISITORS[event]) {
                if (typeof plugin[event] === 'object') {
                  for (let filter in plugin[event]) {
                    if (filter === '*') {
                      add(plugin, event, plugin[event][filter]);
                    } else {
                      add(
                        plugin,
                        event + '-' + filter.toLowerCase(),
                        plugin[event][filter]
                      );
                    }
                  }
                } else if (typeof plugin[event] === 'function') {
                  add(plugin, event, plugin[event]);
                }
              }
            }
          }
        }
        this.hasListener = Object.keys(this.listeners).length > 0;
      }

      visitTick(stack) {
        let visit = stack[stack.length - 1];
        let { node, visitors } = visit;

        if (node.type !== 'root' && node.type !== 'document' && !node.parent) {
          stack.pop();
          return
        }

        if (visitors.length > 0 && visit.visitorIndex < visitors.length) {
          let [plugin, visitor] = visitors[visit.visitorIndex];
          visit.visitorIndex += 1;
          if (visit.visitorIndex === visitors.length) {
            visit.visitors = [];
            visit.visitorIndex = 0;
          }
          this.result.lastPlugin = plugin;
          try {
            return visitor(node.toProxy(), this.helpers)
          } catch (e) {
            throw this.handleError(e, node)
          }
        }

        if (visit.iterator !== 0) {
          let iterator = visit.iterator;
          let child;
          while ((child = node.nodes[node.indexes[iterator]])) {
            node.indexes[iterator] += 1;
            if (!child[isClean]) {
              child[isClean] = true;
              stack.push(toStack(child));
              return
            }
          }
          visit.iterator = 0;
          delete node.indexes[iterator];
        }

        let events = visit.events;
        while (visit.eventIndex < events.length) {
          let event = events[visit.eventIndex];
          visit.eventIndex += 1;
          if (event === CHILDREN) {
            if (node.nodes && node.nodes.length) {
              node[isClean] = true;
              visit.iterator = node.getIterator();
            }
            return
          } else if (this.listeners[event]) {
            visit.visitors = this.listeners[event];
            return
          }
        }
        stack.pop();
      }
    }

    LazyResult.registerPostcss = dependant => {
      postcss$1 = dependant;
    };

    var lazyResult = LazyResult;
    LazyResult.default = LazyResult;

    root.registerLazyResult(LazyResult);
    document$1.registerLazyResult(LazyResult);

    class NoWorkResult {
      constructor(processor, css, opts) {
        css = css.toString();
        this.stringified = false;

        this._processor = processor;
        this._css = css;
        this._opts = opts;
        this._map = undefined;
        let root;

        let str = stringify_1;
        this.result = new result(this._processor, root, this._opts);
        this.result.css = css;

        let self = this;
        Object.defineProperty(this.result, 'root', {
          get() {
            return self.root
          }
        });

        let map = new mapGenerator(str, root, this._opts, css);
        if (map.isMap()) {
          let [generatedCSS, generatedMap] = map.generate();
          if (generatedCSS) {
            this.result.css = generatedCSS;
          }
          if (generatedMap) {
            this.result.map = generatedMap;
          }
        }
      }

      get [Symbol.toStringTag]() {
        return 'NoWorkResult'
      }

      get processor() {
        return this.result.processor
      }

      get opts() {
        return this.result.opts
      }

      get css() {
        return this.result.css
      }

      get content() {
        return this.result.css
      }

      get map() {
        return this.result.map
      }

      get root() {
        if (this._root) {
          return this._root
        }

        let root;
        let parser = parse_1;

        try {
          root = parser(this._css, this._opts);
        } catch (error) {
          this.error = error;
        }

        if (this.error) {
          throw this.error
        } else {
          this._root = root;
          return root
        }
      }

      get messages() {
        return []
      }

      warnings() {
        return []
      }

      toString() {
        return this._css
      }

      then(onFulfilled, onRejected) {
        if (process.env.NODE_ENV !== 'production') {
          if (!('from' in this._opts)) {
            warnOnce(
              'Without `from` option PostCSS could generate wrong source map ' +
                'and will not find Browserslist config. Set it to CSS file path ' +
                'or to `undefined` to prevent this warning.'
            );
          }
        }

        return this.async().then(onFulfilled, onRejected)
      }

      catch(onRejected) {
        return this.async().catch(onRejected)
      }

      finally(onFinally) {
        return this.async().then(onFinally, onFinally)
      }

      async() {
        if (this.error) return Promise.reject(this.error)
        return Promise.resolve(this.result)
      }

      sync() {
        if (this.error) throw this.error
        return this.result
      }
    }

    var noWorkResult = NoWorkResult;
    NoWorkResult.default = NoWorkResult;

    class Processor {
      constructor(plugins = []) {
        this.version = '8.4.21';
        this.plugins = this.normalize(plugins);
      }

      use(plugin) {
        this.plugins = this.plugins.concat(this.normalize([plugin]));
        return this
      }

      process(css, opts = {}) {
        if (
          this.plugins.length === 0 &&
          typeof opts.parser === 'undefined' &&
          typeof opts.stringifier === 'undefined' &&
          typeof opts.syntax === 'undefined'
        ) {
          return new noWorkResult(this, css, opts)
        } else {
          return new lazyResult(this, css, opts)
        }
      }

      normalize(plugins) {
        let normalized = [];
        for (let i of plugins) {
          if (i.postcss === true) {
            i = i();
          } else if (i.postcss) {
            i = i.postcss;
          }

          if (typeof i === 'object' && Array.isArray(i.plugins)) {
            normalized = normalized.concat(i.plugins);
          } else if (typeof i === 'object' && i.postcssPlugin) {
            normalized.push(i);
          } else if (typeof i === 'function') {
            normalized.push(i);
          } else if (typeof i === 'object' && (i.parse || i.stringify)) {
            if (process.env.NODE_ENV !== 'production') {
              throw new Error(
                'PostCSS syntaxes cannot be used as plugins. Instead, please use ' +
                  'one of the syntax/parser/stringifier options as outlined ' +
                  'in your PostCSS runner documentation.'
              )
            }
          } else {
            throw new Error(i + ' is not a PostCSS plugin')
          }
        }
        return normalized
      }
    }

    var processor = Processor;
    Processor.default = Processor;

    root.registerProcessor(Processor);
    document$1.registerProcessor(Processor);

    function fromJSON(json, inputs) {
      if (Array.isArray(json)) return json.map(n => fromJSON(n))

      let { inputs: ownInputs, ...defaults } = json;
      if (ownInputs) {
        inputs = [];
        for (let input$1 of ownInputs) {
          let inputHydrated = { ...input$1, __proto__: input.prototype };
          if (inputHydrated.map) {
            inputHydrated.map = {
              ...inputHydrated.map,
              __proto__: previousMap.prototype
            };
          }
          inputs.push(inputHydrated);
        }
      }
      if (defaults.nodes) {
        defaults.nodes = json.nodes.map(n => fromJSON(n, inputs));
      }
      if (defaults.source) {
        let { inputId, ...source } = defaults.source;
        defaults.source = source;
        if (inputId != null) {
          defaults.source.input = inputs[inputId];
        }
      }
      if (defaults.type === 'root') {
        return new root(defaults)
      } else if (defaults.type === 'decl') {
        return new declaration(defaults)
      } else if (defaults.type === 'rule') {
        return new rule(defaults)
      } else if (defaults.type === 'comment') {
        return new comment(defaults)
      } else if (defaults.type === 'atrule') {
        return new atRule(defaults)
      } else {
        throw new Error('Unknown node type: ' + json.type)
      }
    }

    var fromJSON_1 = fromJSON;
    fromJSON.default = fromJSON;

    function postcss(...plugins) {
      if (plugins.length === 1 && Array.isArray(plugins[0])) {
        plugins = plugins[0];
      }
      return new processor(plugins)
    }

    postcss.plugin = function plugin(name, initializer) {
      let warningPrinted = false;
      function creator(...args) {
        // eslint-disable-next-line no-console
        if (console && console.warn && !warningPrinted) {
          warningPrinted = true;
          // eslint-disable-next-line no-console
          console.warn(
            name +
              ': postcss.plugin was deprecated. Migration guide:\n' +
              'https://evilmartians.com/chronicles/postcss-8-plugin-migration'
          );
          if (process.env.LANG && process.env.LANG.startsWith('cn')) {
            /* c8 ignore next 7 */
            // eslint-disable-next-line no-console
            console.warn(
              name +
                ': 里面 postcss.plugin 被弃用. 迁移指南:\n' +
                'https://www.w3ctech.com/topic/2226'
            );
          }
        }
        let transformer = initializer(...args);
        transformer.postcssPlugin = name;
        transformer.postcssVersion = new processor().version;
        return transformer
      }

      let cache;
      Object.defineProperty(creator, 'postcss', {
        get() {
          if (!cache) cache = creator();
          return cache
        }
      });

      creator.process = function (css, processOpts, pluginOpts) {
        return postcss([creator(pluginOpts)]).process(css, processOpts)
      };

      return creator
    };

    postcss.stringify = stringify_1;
    postcss.parse = parse_1;
    postcss.fromJSON = fromJSON_1;
    postcss.list = list_1;

    postcss.comment = defaults => new comment(defaults);
    postcss.atRule = defaults => new atRule(defaults);
    postcss.decl = defaults => new declaration(defaults);
    postcss.rule = defaults => new rule(defaults);
    postcss.root = defaults => new root(defaults);
    postcss.document = defaults => new document$1(defaults);

    postcss.CssSyntaxError = cssSyntaxError;
    postcss.Declaration = declaration;
    postcss.Container = container;
    postcss.Processor = processor;
    postcss.Document = document$1;
    postcss.Comment = comment;
    postcss.Warning = warning;
    postcss.AtRule = atRule;
    postcss.Result = result;
    postcss.Input = input;
    postcss.Rule = rule;
    postcss.Root = root;
    postcss.Node = node_1;

    lazyResult.registerPostcss(postcss);

    var postcss_1 = postcss;
    postcss.default = postcss;

    var htmlparser = lib;

    const { isPlainObject } = isPlainObject_1;


    const { parse: postcssParse } = postcss_1;
    // Tags that can conceivably represent stand-alone media.
    const mediaTags = [
      'img', 'audio', 'video', 'picture', 'svg',
      'object', 'map', 'iframe', 'embed'
    ];
    // Tags that are inherently vulnerable to being used in XSS attacks.
    const vulnerableTags = [ 'script', 'style' ];

    function each(obj, cb) {
      if (obj) {
        Object.keys(obj).forEach(function (key) {
          cb(obj[key], key);
        });
      }
    }

    // Avoid false positives with .__proto__, .hasOwnProperty, etc.
    function has(obj, key) {
      return ({}).hasOwnProperty.call(obj, key);
    }

    // Returns those elements of `a` for which `cb(a)` returns truthy
    function filter(a, cb) {
      const n = [];
      each(a, function(v) {
        if (cb(v)) {
          n.push(v);
        }
      });
      return n;
    }

    function isEmptyObject(obj) {
      for (const key in obj) {
        if (has(obj, key)) {
          return false;
        }
      }
      return true;
    }

    function stringifySrcset(parsedSrcset) {
      return parsedSrcset.map(function(part) {
        if (!part.url) {
          throw new Error('URL missing');
        }

        return (
          part.url +
          (part.w ? ` ${part.w}w` : '') +
          (part.h ? ` ${part.h}h` : '') +
          (part.d ? ` ${part.d}x` : '')
        );
      }).join(', ');
    }

    var sanitizeHtml_1 = sanitizeHtml;

    // A valid attribute name.
    // We use a tolerant definition based on the set of strings defined by
    // html.spec.whatwg.org/multipage/parsing.html#before-attribute-name-state
    // and html.spec.whatwg.org/multipage/parsing.html#attribute-name-state .
    // The characters accepted are ones which can be appended to the attribute
    // name buffer without triggering a parse error:
    //   * unexpected-equals-sign-before-attribute-name
    //   * unexpected-null-character
    //   * unexpected-character-in-attribute-name
    // We exclude the empty string because it's impossible to get to the after
    // attribute name state with an empty attribute name buffer.
    const VALID_HTML_ATTRIBUTE_NAME = /^[^\0\t\n\f\r /<=>]+$/;

    // Ignore the _recursing flag; it's there for recursive
    // invocation as a guard against this exploit:
    // https://github.com/fb55/htmlparser2/issues/105

    function sanitizeHtml(html, options, _recursing) {
      if (html == null) {
        return '';
      }
      if (typeof html === 'number') {
        html = html.toString();
      }

      let result = '';
      // Used for hot swapping the result variable with an empty string in order to "capture" the text written to it.
      let tempResult = '';

      function Frame(tag, attribs) {
        const that = this;
        this.tag = tag;
        this.attribs = attribs || {};
        this.tagPosition = result.length;
        this.text = ''; // Node inner text
        this.mediaChildren = [];

        this.updateParentNodeText = function() {
          if (stack.length) {
            const parentFrame = stack[stack.length - 1];
            parentFrame.text += that.text;
          }
        };

        this.updateParentNodeMediaChildren = function() {
          if (stack.length && mediaTags.includes(this.tag)) {
            const parentFrame = stack[stack.length - 1];
            parentFrame.mediaChildren.push(this.tag);
          }
        };
      }

      options = Object.assign({}, sanitizeHtml.defaults, options);
      options.parser = Object.assign({}, htmlParserDefaults, options.parser);

      const tagAllowed = function (name) {
        return options.allowedTags === false || (options.allowedTags || []).indexOf(name) > -1;
      };

      // vulnerableTags
      vulnerableTags.forEach(function (tag) {
        if (tagAllowed(tag) && !options.allowVulnerableTags) {
          console.warn(`\n\n⚠️ Your \`allowedTags\` option includes, \`${tag}\`, which is inherently\nvulnerable to XSS attacks. Please remove it from \`allowedTags\`.\nOr, to disable this warning, add the \`allowVulnerableTags\` option\nand ensure you are accounting for this risk.\n\n`);
        }
      });

      // Tags that contain something other than HTML, or where discarding
      // the text when the tag is disallowed makes sense for other reasons.
      // If we are not allowing these tags, we should drop their content too.
      // For other tags you would drop the tag but keep its content.
      const nonTextTagsArray = options.nonTextTags || [
        'script',
        'style',
        'textarea',
        'option'
      ];
      let allowedAttributesMap;
      let allowedAttributesGlobMap;
      if (options.allowedAttributes) {
        allowedAttributesMap = {};
        allowedAttributesGlobMap = {};
        each(options.allowedAttributes, function(attributes, tag) {
          allowedAttributesMap[tag] = [];
          const globRegex = [];
          attributes.forEach(function(obj) {
            if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
              globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
            } else {
              allowedAttributesMap[tag].push(obj);
            }
          });
          if (globRegex.length) {
            allowedAttributesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
          }
        });
      }
      const allowedClassesMap = {};
      const allowedClassesGlobMap = {};
      const allowedClassesRegexMap = {};
      each(options.allowedClasses, function(classes, tag) {
        // Implicitly allows the class attribute
        if (allowedAttributesMap) {
          if (!has(allowedAttributesMap, tag)) {
            allowedAttributesMap[tag] = [];
          }
          allowedAttributesMap[tag].push('class');
        }

        allowedClassesMap[tag] = [];
        allowedClassesRegexMap[tag] = [];
        const globRegex = [];
        classes.forEach(function(obj) {
          if (typeof obj === 'string' && obj.indexOf('*') >= 0) {
            globRegex.push(escapeStringRegexp(obj).replace(/\\\*/g, '.*'));
          } else if (obj instanceof RegExp) {
            allowedClassesRegexMap[tag].push(obj);
          } else {
            allowedClassesMap[tag].push(obj);
          }
        });
        if (globRegex.length) {
          allowedClassesGlobMap[tag] = new RegExp('^(' + globRegex.join('|') + ')$');
        }
      });

      const transformTagsMap = {};
      let transformTagsAll;
      each(options.transformTags, function(transform, tag) {
        let transFun;
        if (typeof transform === 'function') {
          transFun = transform;
        } else if (typeof transform === 'string') {
          transFun = sanitizeHtml.simpleTransform(transform);
        }
        if (tag === '*') {
          transformTagsAll = transFun;
        } else {
          transformTagsMap[tag] = transFun;
        }
      });

      let depth;
      let stack;
      let skipMap;
      let transformMap;
      let skipText;
      let skipTextDepth;
      let addedText = false;

      initializeState();

      const parser = new htmlparser.Parser({
        onopentag: function(name, attribs) {
          // If `enforceHtmlBoundary` is `true` and this has found the opening
          // `html` tag, reset the state.
          if (options.enforceHtmlBoundary && name === 'html') {
            initializeState();
          }

          if (skipText) {
            skipTextDepth++;
            return;
          }
          const frame = new Frame(name, attribs);
          stack.push(frame);

          let skip = false;
          const hasText = !!frame.text;
          let transformedTag;
          if (has(transformTagsMap, name)) {
            transformedTag = transformTagsMap[name](name, attribs);

            frame.attribs = attribs = transformedTag.attribs;

            if (transformedTag.text !== undefined) {
              frame.innerText = transformedTag.text;
            }

            if (name !== transformedTag.tagName) {
              frame.name = name = transformedTag.tagName;
              transformMap[depth] = transformedTag.tagName;
            }
          }
          if (transformTagsAll) {
            transformedTag = transformTagsAll(name, attribs);

            frame.attribs = attribs = transformedTag.attribs;
            if (name !== transformedTag.tagName) {
              frame.name = name = transformedTag.tagName;
              transformMap[depth] = transformedTag.tagName;
            }
          }

          if (!tagAllowed(name) || (options.disallowedTagsMode === 'recursiveEscape' && !isEmptyObject(skipMap)) || (options.nestingLimit != null && depth >= options.nestingLimit)) {
            skip = true;
            skipMap[depth] = true;
            if (options.disallowedTagsMode === 'discard') {
              if (nonTextTagsArray.indexOf(name) !== -1) {
                skipText = true;
                skipTextDepth = 1;
              }
            }
            skipMap[depth] = true;
          }
          depth++;
          if (skip) {
            if (options.disallowedTagsMode === 'discard') {
              // We want the contents but not this tag
              return;
            }
            tempResult = result;
            result = '';
          }
          result += '<' + name;

          if (name === 'script') {
            if (options.allowedScriptHostnames || options.allowedScriptDomains) {
              frame.innerText = '';
            }
          }

          if (!allowedAttributesMap || has(allowedAttributesMap, name) || allowedAttributesMap['*']) {
            each(attribs, function(value, a) {
              if (!VALID_HTML_ATTRIBUTE_NAME.test(a)) {
                // This prevents part of an attribute name in the output from being
                // interpreted as the end of an attribute, or end of a tag.
                delete frame.attribs[a];
                return;
              }
              // check allowedAttributesMap for the element and attribute and modify the value
              // as necessary if there are specific values defined.
              let passedAllowedAttributesMapCheck = false;
              if (!allowedAttributesMap ||
                (has(allowedAttributesMap, name) && allowedAttributesMap[name].indexOf(a) !== -1) ||
                (allowedAttributesMap['*'] && allowedAttributesMap['*'].indexOf(a) !== -1) ||
                (has(allowedAttributesGlobMap, name) && allowedAttributesGlobMap[name].test(a)) ||
                (allowedAttributesGlobMap['*'] && allowedAttributesGlobMap['*'].test(a))) {
                passedAllowedAttributesMapCheck = true;
              } else if (allowedAttributesMap && allowedAttributesMap[name]) {
                for (const o of allowedAttributesMap[name]) {
                  if (isPlainObject(o) && o.name && (o.name === a)) {
                    passedAllowedAttributesMapCheck = true;
                    let newValue = '';
                    if (o.multiple === true) {
                      // verify the values that are allowed
                      const splitStrArray = value.split(' ');
                      for (const s of splitStrArray) {
                        if (o.values.indexOf(s) !== -1) {
                          if (newValue === '') {
                            newValue = s;
                          } else {
                            newValue += ' ' + s;
                          }
                        }
                      }
                    } else if (o.values.indexOf(value) >= 0) {
                      // verified an allowed value matches the entire attribute value
                      newValue = value;
                    }
                    value = newValue;
                  }
                }
              }
              if (passedAllowedAttributesMapCheck) {
                if (options.allowedSchemesAppliedToAttributes.indexOf(a) !== -1) {
                  if (naughtyHref(name, value)) {
                    delete frame.attribs[a];
                    return;
                  }
                }

                if (name === 'script' && a === 'src') {

                  let allowed = true;

                  try {
                    const parsed = parseUrl(value);

                    if (options.allowedScriptHostnames || options.allowedScriptDomains) {
                      const allowedHostname = (options.allowedScriptHostnames || []).find(function (hostname) {
                        return hostname === parsed.url.hostname;
                      });
                      const allowedDomain = (options.allowedScriptDomains || []).find(function(domain) {
                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                      });
                      allowed = allowedHostname || allowedDomain;
                    }
                  } catch (e) {
                    allowed = false;
                  }

                  if (!allowed) {
                    delete frame.attribs[a];
                    return;
                  }
                }

                if (name === 'iframe' && a === 'src') {
                  let allowed = true;
                  try {
                    const parsed = parseUrl(value);

                    if (parsed.isRelativeUrl) {
                      // default value of allowIframeRelativeUrls is true
                      // unless allowedIframeHostnames or allowedIframeDomains specified
                      allowed = has(options, 'allowIframeRelativeUrls')
                        ? options.allowIframeRelativeUrls
                        : (!options.allowedIframeHostnames && !options.allowedIframeDomains);
                    } else if (options.allowedIframeHostnames || options.allowedIframeDomains) {
                      const allowedHostname = (options.allowedIframeHostnames || []).find(function (hostname) {
                        return hostname === parsed.url.hostname;
                      });
                      const allowedDomain = (options.allowedIframeDomains || []).find(function(domain) {
                        return parsed.url.hostname === domain || parsed.url.hostname.endsWith(`.${domain}`);
                      });
                      allowed = allowedHostname || allowedDomain;
                    }
                  } catch (e) {
                    // Unparseable iframe src
                    allowed = false;
                  }
                  if (!allowed) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === 'srcset') {
                  try {
                    let parsed = parseSrcset(value);
                    parsed.forEach(function(value) {
                      if (naughtyHref('srcset', value.url)) {
                        value.evil = true;
                      }
                    });
                    parsed = filter(parsed, function(v) {
                      return !v.evil;
                    });
                    if (!parsed.length) {
                      delete frame.attribs[a];
                      return;
                    } else {
                      value = stringifySrcset(filter(parsed, function(v) {
                        return !v.evil;
                      }));
                      frame.attribs[a] = value;
                    }
                  } catch (e) {
                    // Unparseable srcset
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === 'class') {
                  const allowedSpecificClasses = allowedClassesMap[name];
                  const allowedWildcardClasses = allowedClassesMap['*'];
                  const allowedSpecificClassesGlob = allowedClassesGlobMap[name];
                  const allowedSpecificClassesRegex = allowedClassesRegexMap[name];
                  const allowedWildcardClassesGlob = allowedClassesGlobMap['*'];
                  const allowedClassesGlobs = [
                    allowedSpecificClassesGlob,
                    allowedWildcardClassesGlob
                  ]
                    .concat(allowedSpecificClassesRegex)
                    .filter(function (t) {
                      return t;
                    });
                  if (allowedSpecificClasses && allowedWildcardClasses) {
                    value = filterClasses(value, cjs(allowedSpecificClasses, allowedWildcardClasses), allowedClassesGlobs);
                  } else {
                    value = filterClasses(value, allowedSpecificClasses || allowedWildcardClasses, allowedClassesGlobs);
                  }
                  if (!value.length) {
                    delete frame.attribs[a];
                    return;
                  }
                }
                if (a === 'style') {
                  if (options.parseStyleAttributes) {
                    try {
                      const abstractSyntaxTree = postcssParse(name + ' {' + value + '}');
                      const filteredAST = filterCss(abstractSyntaxTree, options.allowedStyles);

                      value = stringifyStyleAttributes(filteredAST);

                      if (value.length === 0) {
                        delete frame.attribs[a];
                        return;
                      }
                    } catch (e) {
                      console.warn('Failed to parse "' + name + ' {' + value + '}' + '", If you\'re running this in a browser, we recommend to disable style parsing: options.parseStyleAttributes: false, since this only works in a node environment due to a postcss dependency, More info: https://github.com/apostrophecms/sanitize-html/issues/547');
                      delete frame.attribs[a];
                      return;
                    }
                  } else if (options.allowedStyles) {
                    throw new Error('allowedStyles option cannot be used together with parseStyleAttributes: false.');
                  }
                }
                result += ' ' + a;
                if (value && value.length) {
                  result += '="' + escapeHtml(value, true) + '"';
                }
              } else {
                delete frame.attribs[a];
              }
            });
          }
          if (options.selfClosing.indexOf(name) !== -1) {
            result += ' />';
          } else {
            result += '>';
            if (frame.innerText && !hasText && !options.textFilter) {
              result += escapeHtml(frame.innerText);
              addedText = true;
            }
          }
          if (skip) {
            result = tempResult + escapeHtml(result);
            tempResult = '';
          }
        },
        ontext: function(text) {
          if (skipText) {
            return;
          }
          const lastFrame = stack[stack.length - 1];
          let tag;

          if (lastFrame) {
            tag = lastFrame.tag;
            // If inner text was set by transform function then let's use it
            text = lastFrame.innerText !== undefined ? lastFrame.innerText : text;
          }

          if (options.disallowedTagsMode === 'discard' && ((tag === 'script') || (tag === 'style'))) {
            // htmlparser2 gives us these as-is. Escaping them ruins the content. Allowing
            // script tags is, by definition, game over for XSS protection, so if that's
            // your concern, don't allow them. The same is essentially true for style tags
            // which have their own collection of XSS vectors.
            result += text;
          } else {
            const escaped = escapeHtml(text, false);
            if (options.textFilter && !addedText) {
              result += options.textFilter(escaped, tag);
            } else if (!addedText) {
              result += escaped;
            }
          }
          if (stack.length) {
            const frame = stack[stack.length - 1];
            frame.text += text;
          }
        },
        onclosetag: function(name, isImplied) {

          if (skipText) {
            skipTextDepth--;
            if (!skipTextDepth) {
              skipText = false;
            } else {
              return;
            }
          }

          const frame = stack.pop();
          if (!frame) {
            // Do not crash on bad markup
            return;
          }

          if (frame.tag !== name) {
            // Another case of bad markup.
            // Push to stack, so that it will be used in future closing tags.
            stack.push(frame);
            return;
          }

          skipText = options.enforceHtmlBoundary ? name === 'html' : false;
          depth--;
          const skip = skipMap[depth];
          if (skip) {
            delete skipMap[depth];
            if (options.disallowedTagsMode === 'discard') {
              frame.updateParentNodeText();
              return;
            }
            tempResult = result;
            result = '';
          }

          if (transformMap[depth]) {
            name = transformMap[depth];
            delete transformMap[depth];
          }

          if (options.exclusiveFilter && options.exclusiveFilter(frame)) {
            result = result.substr(0, frame.tagPosition);
            return;
          }

          frame.updateParentNodeMediaChildren();
          frame.updateParentNodeText();

          if (
            // Already output />
            options.selfClosing.indexOf(name) !== -1 ||
            // Escaped tag, closing tag is implied
            (isImplied && !tagAllowed(name) && [ 'escape', 'recursiveEscape' ].indexOf(options.disallowedTagsMode) >= 0)
          ) {
            if (skip) {
              result = tempResult;
              tempResult = '';
            }
            return;
          }

          result += '</' + name + '>';
          if (skip) {
            result = tempResult + escapeHtml(result);
            tempResult = '';
          }
          addedText = false;
        }
      }, options.parser);
      parser.write(html);
      parser.end();

      return result;

      function initializeState() {
        result = '';
        depth = 0;
        stack = [];
        skipMap = {};
        transformMap = {};
        skipText = false;
        skipTextDepth = 0;
      }

      function escapeHtml(s, quote) {
        if (typeof (s) !== 'string') {
          s = s + '';
        }
        if (options.parser.decodeEntities) {
          s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          if (quote) {
            s = s.replace(/"/g, '&quot;');
          }
        }
        // TODO: this is inadequate because it will pass `&0;`. This approach
        // will not work, each & must be considered with regard to whether it
        // is followed by a 100% syntactically valid entity or not, and escaped
        // if it is not. If this bothers you, don't set parser.decodeEntities
        // to false. (The default is true.)
        s = s.replace(/&(?![a-zA-Z0-9#]{1,20};)/g, '&amp;') // Match ampersands not part of existing HTML entity
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        if (quote) {
          s = s.replace(/"/g, '&quot;');
        }
        return s;
      }

      function naughtyHref(name, href) {
        // Browsers ignore character codes of 32 (space) and below in a surprising
        // number of situations. Start reading here:
        // https://www.owasp.org/index.php/XSS_Filter_Evasion_Cheat_Sheet#Embedded_tab
        // eslint-disable-next-line no-control-regex
        href = href.replace(/[\x00-\x20]+/g, '');
        // Clobber any comments in URLs, which the browser might
        // interpret inside an XML data island, allowing
        // a javascript: URL to be snuck through
        while (true) {
          const firstIndex = href.indexOf('<!--');
          if (firstIndex === -1) {
            break;
          }
          const lastIndex = href.indexOf('-->', firstIndex + 4);
          if (lastIndex === -1) {
            break;
          }
          href = href.substring(0, firstIndex) + href.substring(lastIndex + 3);
        }
        // Case insensitive so we don't get faked out by JAVASCRIPT #1
        // Allow more characters after the first so we don't get faked
        // out by certain schemes browsers accept
        const matches = href.match(/^([a-zA-Z][a-zA-Z0-9.\-+]*):/);
        if (!matches) {
          // Protocol-relative URL starting with any combination of '/' and '\'
          if (href.match(/^[/\\]{2}/)) {
            return !options.allowProtocolRelative;
          }

          // No scheme
          return false;
        }
        const scheme = matches[1].toLowerCase();

        if (has(options.allowedSchemesByTag, name)) {
          return options.allowedSchemesByTag[name].indexOf(scheme) === -1;
        }

        return !options.allowedSchemes || options.allowedSchemes.indexOf(scheme) === -1;
      }

      function parseUrl(value) {
        value = value.replace(/^(\w+:)?\s*[\\/]\s*[\\/]/, '$1//');
        if (value.startsWith('relative:')) {
          // An attempt to exploit our workaround for base URLs being
          // mandatory for relative URL validation in the WHATWG
          // URL parser, reject it
          throw new Error('relative: exploit attempt');
        }
        // naughtyHref is in charge of whether protocol relative URLs
        // are cool. Here we are concerned just with allowed hostnames and
        // whether to allow relative URLs.
        //
        // Build a placeholder "base URL" against which any reasonable
        // relative URL may be parsed successfully
        let base = 'relative://relative-site';
        for (let i = 0; (i < 100); i++) {
          base += `/${i}`;
        }

        const parsed = new URL(value, base);

        const isRelativeUrl = parsed && parsed.hostname === 'relative-site' && parsed.protocol === 'relative:';
        return {
          isRelativeUrl,
          url: parsed
        };
      }
      /**
       * Filters user input css properties by allowlisted regex attributes.
       * Modifies the abstractSyntaxTree object.
       *
       * @param {object} abstractSyntaxTree  - Object representation of CSS attributes.
       * @property {array[Declaration]} abstractSyntaxTree.nodes[0] - Each object cointains prop and value key, i.e { prop: 'color', value: 'red' }.
       * @param {object} allowedStyles       - Keys are properties (i.e color), value is list of permitted regex rules (i.e /green/i).
       * @return {object}                    - The modified tree.
       */
      function filterCss(abstractSyntaxTree, allowedStyles) {
        if (!allowedStyles) {
          return abstractSyntaxTree;
        }

        const astRules = abstractSyntaxTree.nodes[0];
        let selectedRule;

        // Merge global and tag-specific styles into new AST.
        if (allowedStyles[astRules.selector] && allowedStyles['*']) {
          selectedRule = cjs(
            allowedStyles[astRules.selector],
            allowedStyles['*']
          );
        } else {
          selectedRule = allowedStyles[astRules.selector] || allowedStyles['*'];
        }

        if (selectedRule) {
          abstractSyntaxTree.nodes[0].nodes = astRules.nodes.reduce(filterDeclarations(selectedRule), []);
        }

        return abstractSyntaxTree;
      }

      /**
       * Extracts the style attributes from an AbstractSyntaxTree and formats those
       * values in the inline style attribute format.
       *
       * @param  {AbstractSyntaxTree} filteredAST
       * @return {string}             - Example: "color:yellow;text-align:center !important;font-family:helvetica;"
       */
      function stringifyStyleAttributes(filteredAST) {
        return filteredAST.nodes[0].nodes
          .reduce(function(extractedAttributes, attrObject) {
            extractedAttributes.push(
              `${attrObject.prop}:${attrObject.value}${attrObject.important ? ' !important' : ''}`
            );
            return extractedAttributes;
          }, [])
          .join(';');
      }

      /**
        * Filters the existing attributes for the given property. Discards any attributes
        * which don't match the allowlist.
        *
        * @param  {object} selectedRule             - Example: { color: red, font-family: helvetica }
        * @param  {array} allowedDeclarationsList   - List of declarations which pass the allowlist.
        * @param  {object} attributeObject          - Object representing the current css property.
        * @property {string} attributeObject.type   - Typically 'declaration'.
        * @property {string} attributeObject.prop   - The CSS property, i.e 'color'.
        * @property {string} attributeObject.value  - The corresponding value to the css property, i.e 'red'.
        * @return {function}                        - When used in Array.reduce, will return an array of Declaration objects
        */
      function filterDeclarations(selectedRule) {
        return function (allowedDeclarationsList, attributeObject) {
          // If this property is allowlisted...
          if (has(selectedRule, attributeObject.prop)) {
            const matchesRegex = selectedRule[attributeObject.prop].some(function(regularExpression) {
              return regularExpression.test(attributeObject.value);
            });

            if (matchesRegex) {
              allowedDeclarationsList.push(attributeObject);
            }
          }
          return allowedDeclarationsList;
        };
      }

      function filterClasses(classes, allowed, allowedGlobs) {
        if (!allowed) {
          // The class attribute is allowed without filtering on this tag
          return classes;
        }
        classes = classes.split(/\s+/);
        return classes.filter(function(clss) {
          return allowed.indexOf(clss) !== -1 || allowedGlobs.some(function(glob) {
            return glob.test(clss);
          });
        }).join(' ');
      }
    }

    // Defaults are accessible to you so that you can use them as a starting point
    // programmatically if you wish

    const htmlParserDefaults = {
      decodeEntities: true
    };
    sanitizeHtml.defaults = {
      allowedTags: [
        // Sections derived from MDN element categories and limited to the more
        // benign categories.
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element
        // Content sectioning
        'address', 'article', 'aside', 'footer', 'header',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hgroup',
        'main', 'nav', 'section',
        // Text content
        'blockquote', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure',
        'hr', 'li', 'main', 'ol', 'p', 'pre', 'ul',
        // Inline text semantics
        'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
        'em', 'i', 'kbd', 'mark', 'q',
        'rb', 'rp', 'rt', 'rtc', 'ruby',
        's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
        // Table content
        'caption', 'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th',
        'thead', 'tr'
      ],
      disallowedTagsMode: 'discard',
      allowedAttributes: {
        a: [ 'href', 'name', 'target' ],
        // We don't currently allow img itself by default, but
        // these attributes would make sense if we did.
        img: [ 'src', 'srcset', 'alt', 'title', 'width', 'height', 'loading' ]
      },
      // Lots of these won't come up by default because we don't allow them
      selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' ],
      // URL schemes we permit
      allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel' ],
      allowedSchemesByTag: {},
      allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
      allowProtocolRelative: true,
      enforceHtmlBoundary: false,
      parseStyleAttributes: true
    };

    sanitizeHtml.simpleTransform = function(newTagName, newAttribs, merge) {
      merge = (merge === undefined) ? true : merge;
      newAttribs = newAttribs || {};

      return function(tagName, attribs) {
        let attrib;
        if (merge) {
          for (attrib in newAttribs) {
            attribs[attrib] = newAttribs[attrib];
          }
        } else {
          attribs = newAttribs;
        }

        return {
          tagName: newTagName,
          attribs: attribs
        };
      };
    };

    var sanitizeHtml$1 = sanitizeHtml_1;

    /* src/App.svelte generated by Svelte v3.55.1 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[14] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    // (68:4) {#each ['gpt-3.5-turbo', 'gpt-4'] as model}
    function create_each_block_1(ctx) {
    	let option;
    	let t;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(/*model*/ ctx[17]);
    			option.__value = /*model*/ ctx[17];
    			option.value = option.__value;
    			add_location(option, file, 68, 5, 2121);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(68:4) {#each ['gpt-3.5-turbo', 'gpt-4'] as model}",
    		ctx
    	});

    	return block;
    }

    // (85:3) {#if msg.role !== 'system'}
    function create_if_block(ctx) {
    	let div1;
    	let div0;
    	let raw_value = sanitizeHtml$1(/*msg*/ ctx[14].content.replace(/\n/g, '<br>'), { allowedTags: ['br'] }) + "";
    	let div0_class_value;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", div0_class_value = "" + (null_to_empty(/*msg*/ ctx[14].role + '-msg') + " svelte-1jpce10"));
    			add_location(div0, file, 86, 4, 2639);
    			attr_dev(div1, "id", "msg-container");
    			attr_dev(div1, "class", "svelte-1jpce10");
    			add_location(div1, file, 85, 3, 2609);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			div0.innerHTML = raw_value;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*messages*/ 16 && raw_value !== (raw_value = sanitizeHtml$1(/*msg*/ ctx[14].content.replace(/\n/g, '<br>'), { allowedTags: ['br'] }) + "")) div0.innerHTML = raw_value;
    			if (dirty & /*messages*/ 16 && div0_class_value !== (div0_class_value = "" + (null_to_empty(/*msg*/ ctx[14].role + '-msg') + " svelte-1jpce10"))) {
    				attr_dev(div0, "class", div0_class_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(85:3) {#if msg.role !== 'system'}",
    		ctx
    	});

    	return block;
    }

    // (84:2) {#each messages as msg}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*msg*/ ctx[14].role !== 'system' && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*msg*/ ctx[14].role !== 'system') {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(84:2) {#each messages as msg}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div3;
    	let t0;
    	let textarea0;
    	let t1;
    	let div0;
    	let t2;
    	let select;
    	let t3;
    	let div1;
    	let t4;
    	let input0;
    	let t5;
    	let div2;
    	let t6;
    	let input1;
    	let t7;
    	let div4;
    	let t8;
    	let textarea1;
    	let mounted;
    	let dispose;
    	let each_value_1 = ['gpt-3.5-turbo', 'gpt-4'];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < 2; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*messages*/ ctx[4];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div3 = element("div");
    			t0 = text("System prompt:\r\n\t\t");
    			textarea0 = element("textarea");
    			t1 = space();
    			div0 = element("div");
    			t2 = text("Model:\r\n\t\t\t");
    			select = element("select");

    			for (let i = 0; i < 2; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			div1 = element("div");
    			t4 = text("Temperature:\r\n\t\t\t");
    			input0 = element("input");
    			t5 = space();
    			div2 = element("div");
    			t6 = text("Max tokens:\r\n\t\t\t");
    			input1 = element("input");
    			t7 = space();
    			div4 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			textarea1 = element("textarea");
    			attr_dev(textarea0, "id", "system-prompt-input");
    			attr_dev(textarea0, "class", "svelte-1jpce10");
    			add_location(textarea0, file, 61, 2, 1889);
    			if (/*promptParams*/ ctx[0].model === void 0) add_render_callback(() => /*select_change_handler*/ ctx[8].call(select));
    			set_style(select, "display", `inline-block`);
    			add_location(select, file, 66, 3, 1996);
    			add_location(div0, file, 64, 2, 1975);
    			attr_dev(input0, "type", "number");
    			attr_dev(input0, "step", "0.1");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			set_style(input0, "display", `inline-block`);
    			add_location(input0, file, 74, 3, 2227);
    			add_location(div1, file, 72, 2, 2200);
    			attr_dev(input1, "type", "number");
    			attr_dev(input1, "step", "1");
    			attr_dev(input1, "min", "1");
    			attr_dev(input1, "max", "1000");
    			set_style(input1, "display", `inline-block`);
    			add_location(input1, file, 78, 3, 2384);
    			add_location(div2, file, 76, 2, 2358);
    			attr_dev(div3, "id", "sidebar-div");
    			attr_dev(div3, "class", "svelte-1jpce10");
    			add_location(div3, file, 59, 1, 1845);
    			attr_dev(textarea1, "id", "prompt-input");
    			attr_dev(textarea1, "class", "svelte-1jpce10");
    			add_location(textarea1, file, 93, 2, 2849);
    			attr_dev(div4, "id", "chat-div");
    			attr_dev(div4, "class", "svelte-1jpce10");
    			add_location(div4, file, 82, 1, 2526);
    			attr_dev(main, "class", "svelte-1jpce10");
    			add_location(main, file, 58, 0, 1836);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div3);
    			append_dev(div3, t0);
    			append_dev(div3, textarea0);
    			set_input_value(textarea0, /*systemPrompt*/ ctx[3]);
    			append_dev(div3, t1);
    			append_dev(div3, div0);
    			append_dev(div0, t2);
    			append_dev(div0, select);

    			for (let i = 0; i < 2; i += 1) {
    				each_blocks_1[i].m(select, null);
    			}

    			select_option(select, /*promptParams*/ ctx[0].model);
    			append_dev(div3, t3);
    			append_dev(div3, div1);
    			append_dev(div1, t4);
    			append_dev(div1, input0);
    			set_input_value(input0, /*promptParams*/ ctx[0].temperature);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, t6);
    			append_dev(div2, input1);
    			set_input_value(input1, /*promptParams*/ ctx[0].max_tokens);
    			append_dev(main, t7);
    			append_dev(main, div4);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div4, null);
    			}

    			append_dev(div4, t8);
    			append_dev(div4, textarea1);
    			/*textarea1_binding*/ ctx[11](textarea1);
    			set_input_value(textarea1, /*prompt*/ ctx[2]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea0, "input", /*textarea0_input_handler*/ ctx[7]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[8]),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(textarea1, "input", /*textarea1_input_handler*/ ctx[12]),
    					listen_dev(textarea1, "input", /*resizeTextarea*/ ctx[5], false, false, false),
    					listen_dev(textarea1, "keydown", /*sendPrompt*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*systemPrompt*/ 8) {
    				set_input_value(textarea0, /*systemPrompt*/ ctx[3]);
    			}

    			if (dirty & /*promptParams*/ 1) {
    				select_option(select, /*promptParams*/ ctx[0].model);
    			}

    			if (dirty & /*promptParams*/ 1 && to_number(input0.value) !== /*promptParams*/ ctx[0].temperature) {
    				set_input_value(input0, /*promptParams*/ ctx[0].temperature);
    			}

    			if (dirty & /*promptParams*/ 1 && to_number(input1.value) !== /*promptParams*/ ctx[0].max_tokens) {
    				set_input_value(input1, /*promptParams*/ ctx[0].max_tokens);
    			}

    			if (dirty & /*messages, sanitizeHtml*/ 16) {
    				each_value = /*messages*/ ctx[4];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div4, t8);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*prompt*/ 4) {
    				set_input_value(textarea1, /*prompt*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*textarea1_binding*/ ctx[11](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	const promptParams = {
    		'model': 'gpt-3.5-turbo',
    		'max_tokens': 200,
    		'temperature': 1,
    		'stream': false
    	};

    	console.log("DEV");
    	let promptTextarea;
    	let prompt = "";
    	let systemPrompt = "";
    	let messages = [];

    	onMount(() => {
    		$$invalidate(1, promptTextarea.style.height = 'auto', promptTextarea);
    		promptTextarea.focus();
    	});

    	function addMessage(role, content) {
    		const newMessage = { role, content };
    		$$invalidate(4, messages = [...messages, newMessage]);
    	}

    	function resizeTextarea() {
    		const maxHeight = 200;
    		$$invalidate(1, promptTextarea.style.height = 'auto', promptTextarea);
    		$$invalidate(1, promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, maxHeight) + 'px', promptTextarea);
    	}

    	async function sendPrompt(e) {
    		if (!(e.ctrlKey && e.key === 'Enter')) {
    			return;
    		}

    		if (systemPrompt) {
    			$$invalidate(4, messages[0] = { role: 'system', content: systemPrompt }, messages);
    		}

    		addMessage('user', prompt);
    		console.log('sending prompt:' + prompt);
    		console.log('messages:', messages);
    		$$invalidate(2, prompt = "");
    		$$invalidate(1, promptTextarea.style.height = 'auto', promptTextarea);

    		const res = await fetch("https://api.openai.com/v1/chat/completions", {
    			method: "POST",
    			headers: {
    				'Content-Type': 'application/json',
    				'Authorization': 'Bearer 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'
    			},
    			body: JSON.stringify(Object.assign(Object.assign({}, promptParams), {
    				messages: messages.filter(msg => msg.role !== 'error')
    			}))
    		});

    		if (!res.ok) {
    			addMessage('error', 'Error: ' + res.status + '\n' + await res.text());
    			return;
    		}

    		const json = await res.json();
    		console.log(json);
    		const content = json.choices[0].message.content.trim();
    		addMessage('assistant', content);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function textarea0_input_handler() {
    		systemPrompt = this.value;
    		$$invalidate(3, systemPrompt);
    	}

    	function select_change_handler() {
    		promptParams.model = select_value(this);
    		$$invalidate(0, promptParams);
    	}

    	function input0_input_handler() {
    		promptParams.temperature = to_number(this.value);
    		$$invalidate(0, promptParams);
    	}

    	function input1_input_handler() {
    		promptParams.max_tokens = to_number(this.value);
    		$$invalidate(0, promptParams);
    	}

    	function textarea1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			promptTextarea = $$value;
    			$$invalidate(1, promptTextarea);
    		});
    	}

    	function textarea1_input_handler() {
    		prompt = this.value;
    		$$invalidate(2, prompt);
    	}

    	$$self.$capture_state = () => ({
    		sanitizeHtml: sanitizeHtml$1,
    		onMount,
    		promptParams,
    		promptTextarea,
    		prompt,
    		systemPrompt,
    		messages,
    		addMessage,
    		resizeTextarea,
    		sendPrompt
    	});

    	$$self.$inject_state = $$props => {
    		if ('promptTextarea' in $$props) $$invalidate(1, promptTextarea = $$props.promptTextarea);
    		if ('prompt' in $$props) $$invalidate(2, prompt = $$props.prompt);
    		if ('systemPrompt' in $$props) $$invalidate(3, systemPrompt = $$props.systemPrompt);
    		if ('messages' in $$props) $$invalidate(4, messages = $$props.messages);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*promptParams*/ 1) {
    			console.log(promptParams);
    		}
    	};

    	return [
    		promptParams,
    		promptTextarea,
    		prompt,
    		systemPrompt,
    		messages,
    		resizeTextarea,
    		sendPrompt,
    		textarea0_input_handler,
    		select_change_handler,
    		input0_input_handler,
    		input1_input_handler,
    		textarea1_binding,
    		textarea1_input_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
