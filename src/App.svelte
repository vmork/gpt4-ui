<svelte:head>	
	<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css">

	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css" integrity="sha384-vKruj+a13U8yHIkAyGgK1J3ArTLzrFGBbBc0tDp4ad/EyewESeXE/Iv67Aj8gKZ0" crossorigin="anonymous">
	<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.js" integrity="sha384-PwRUT/YqbnEjkZO0zZxNqcxACrXe+j766U2amXcgMg5457rve2Y7I6ZJSm2A0mS4" crossorigin="anonymous"
		on:load={() => katexLoaded = true}></script>

</svelte:head>

<script lang="ts">
	import sanitizeHtml from 'sanitize-html';
	import hljs from 'highlight.js';
	import { onMount, beforeUpdate, afterUpdate } from 'svelte';

	import { parseMessage } from './parser'

	const promptParams = {
		'model': 'gpt-3.5-turbo',
		'max_tokens': 1,
		'temperature': 1,
		'stream': false,
	}
	$: console.log(promptParams);
	
	let katexLoaded = false;
	let promptTextarea;
	let prompt = "";
	let systemPrompt = ""
	let messages = [{'role': 'assistant', 'content': "Hello! $x + 1 = 234$, code: ```python\n def f(x): \n    return True loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooong \n```"}];
	// let messages = [{'role': 'assistant', 'content': "<hello> 'i am well'"}];
	// let messages = []
	
	
	onMount(() => {
		promptTextarea.style.height = 'auto';
		promptTextarea.focus();
	});	

	// autoscrolling
	let chatDiv: HTMLDivElement;
	let autoscroll;
	beforeUpdate(() => {
		autoscroll = chatDiv && (chatDiv.offsetHeight + chatDiv.scrollTop) > (chatDiv.scrollHeight - 20);
	})
	afterUpdate(() => {
		if (autoscroll) chatDiv.scrollTo(0, chatDiv.scrollHeight);
	})

	function parseRawMessage(msg: string) {
		if (!katexLoaded) console.log("katex not loaded yet");

		// msg = sanitizeHtml(msg, { allowedTags: [] })
		msg = msg.replace(/&/g, "&amp;")
				 .replace(/</g, "&lt;")
				 .replace(/>/g, "&gt;")
				 .replace(/"/g, "&quot;")
				 .replace(/'/g, "&#039;");

		let output = parseMessage(msg);

		return output;
	}

	function addMessage(role: string, content: string) {
		const newMessage = { role: role, content: content };
		messages = [...messages, newMessage];
	}

	function resizeTextarea() {
		const maxHeight = 200;
		promptTextarea.style.height = 'auto';
		promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, maxHeight) + 'px';
	}
	
	async function sendPrompt(e: KeyboardEvent) {
		if (!(e.ctrlKey && e.key === 'Enter')) { return; }

		let code = document.querySelector("pre")
		console.log("code-elem", code)

		if ( systemPrompt ) {
			messages[0] = { role: 'system', content: systemPrompt };
		}

		addMessage('user', prompt)
		console.log('sending prompt:' + prompt);
		console.log('messages:', messages)

		prompt = "";
		promptTextarea.style.height = 'auto';

		const res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				'Authorization': 'Bearer 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'
			},
			body: JSON.stringify({...promptParams, messages: messages.filter(msg => msg.role !== 'error')})
		})
		if (!res.ok) {
			addMessage('error', 'Error: ' + res.status + '\n' + await res.text())
			return;
		}
		const json = await res.json();
		console.log("json response:", json);
		const content = json.choices[0].message.content.trim();
		console.log("received:", content)
		addMessage('assistant', content);
	}
</script>

<main>
	<div id="sidebar-div">
		System prompt:
		<textarea 
			id="system-prompt-input" 
			bind:value={systemPrompt}></textarea>
		<div>
			Model:
			<select style:display="inline-block" bind:value={promptParams.model}>
				{#each ['gpt-3.5-turbo', 'gpt-4'] as model}
					<option value={model}>{model}</option>
				{/each}
			</select>
		</div>
		<div>
			Temperature:
			<input style:display="inline-block" type="number" step="0.1" min="0" max="1" bind:value={promptParams.temperature} />
		</div>
		<div>
			Max tokens:
			<input style:display="inline-block" type="number" step="1" min="1" max="1000" bind:value={promptParams.max_tokens} />
		</div>
	</div>
	
	<div id="chat-div" bind:this={chatDiv}>
		{#if katexLoaded}
		{#each messages as msg}
			{#if msg.role !== 'system'}
			<div id="msg-container">
				<div class={msg.role + '-msg'}> 
					{@html parseRawMessage(msg.content)} 
				</div>
			</div>
			{/if}
		{/each}
		{/if}
		
		<textarea 
			id="prompt-input" 
			bind:this={promptTextarea} 
			bind:value={prompt} 
			on:input={resizeTextarea}
			on:keydown={sendPrompt}></textarea>
	</div>
</main>

<style lang="scss">
	$white: rgb(233, 242, 242);
	$dark: rgb(3, 22, 22);
	main {
		width: 100%;
		height: 100%;
		display: flex;
	}
	main :global(pre) {
		border: 1px solid rgb(53, 51, 51);
		border-radius: 3px;
		margin: 10px 0px;
		padding: 5px;
		background-color: rgb(255, 255, 255);
		white-space: pre-wrap;
	}
	#sidebar-div {
		padding: 5px;
		margin: 0;
		flex: 0 0 300px;
		display: flex;
		flex-direction: column;
		// align-items: center;
		background-color: $dark;
		color: $white;
	}
	#chat-div {
		background-color: $white;
		color: $dark;
		padding-bottom: 100px;
		padding-bottom: 100px;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		overflow-y: scroll;
		position: relative
	}
	#chat-div::-webkit-scrollbar {
    	display: none;
	}
	#prompt-input {
		font-size: 16px;
		font-family: 'Open Sans', sans-serif;
		margin: 10px;
		width: 50%;
		height: 20%;
		margin-top: auto;
		resize: none;
		position: fixed;
		bottom: 0;
	}
	#system-prompt-input {
		font-size: 16px;
		font-family: 'Open Sans', sans-serif;
		margin: 5px;
		width: 95%;
		height: 20%;
		resize: none;
	}
	#msg-container {
		width: 80%;
		margin: 0;
		padding: 0;	
	}
	.user-msg, .assistant-msg, .error-msg {
		width: 85%;
		margin: 5px;
		padding: 10px;
		overflow-wrap: break-word;
		white-space: pre-line;
		line-height: 150%;
	}
	.user-msg {
		margin-right: auto;
		background-color: rgb(255, 255, 255);
		border-radius: 15px 15px 15px 0;
	}
	.assistant-msg {
		margin-left: auto;
		background-color: rgb(204, 214, 214);
		border-radius: 15px 15px 0 15px;
	}
	.error-msg {
		background-color: rgb(185, 106, 106);
	}

</style>