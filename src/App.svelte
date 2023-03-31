<svelte:head>	
	<link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/default.min.css">

	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css" integrity="sha384-vKruj+a13U8yHIkAyGgK1J3ArTLzrFGBbBc0tDp4ad/EyewESeXE/Iv67Aj8gKZ0" crossorigin="anonymous">
	<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.js" integrity="sha384-PwRUT/YqbnEjkZO0zZxNqcxACrXe+j766U2amXcgMg5457rve2Y7I6ZJSm2A0mS4" crossorigin="anonymous"
		on:load={() => katexLoaded = true}></script>

</svelte:head>

<script lang="ts">
	import { onMount, beforeUpdate, afterUpdate } from 'svelte';
	import { createParser } from 'eventsource-parser'

	import { parseMessage } from './parser'
    import History from './History.svelte';

	const promptParams = {
		'model': 'gpt-3.5-turbo',
		'max_tokens': 500,
		'temperature': 1,
		'stream': true,
	}
	$: console.log(promptParams);

	let API_KEY = ""

	let messagesId;
	let abortController;
	let katexLoaded = false;
	let promptTextarea;
	let prompt = "";
	let systemPrompt = "";
	let messages = [];
	let messageDivs: HTMLDivElement[] = [];
	let chatHistory = localStorage.getItem('history');
	chatHistory = chatHistory ? JSON.parse(chatHistory) : {};
		
	onMount(() => {
		console.log("chatHistory:", chatHistory)
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

	function addMessage(role: string, content: string) {
		const newMessage = { role: role, content: content };
		messages = [...messages, newMessage];
	}

	function resizeTextarea() {
		const maxHeight = 500;
		promptTextarea.style.height = 'auto';
		promptTextarea.style.height = Math.min(promptTextarea.scrollHeight, maxHeight) - 5 + 'px';
	}

	async function sendPromptStreamed() {
		if (!prompt) return;

		addMessage('user', prompt)
		console.log('sending prompt:' + prompt);
		console.log('messages:', messages)

		prompt = "";
		promptTextarea.style.height = 'auto';

		abortController = new AbortController();

		const res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${API_KEY}`
			},
			body: JSON.stringify({...promptParams, messages: messages.filter(msg => msg.role !== 'error')}),
			signal: abortController.signal,
		})

		if (!res.ok) {
			addMessage('error', 'Error: ' + res.status + '\n' + await res.text())
			return;
		}

		const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
		const parser = createParser((event) => {
			if (event.type === "event") {
				if (event.data === "[DONE]") { return }
				const json = JSON.parse(event.data);
				const text = json.choices[0].delta.content;
				if (text !== undefined) {
					messages[messages.length - 1].content += text;
				}
			}
		});
		
		addMessage('assistant', '')
		while (true) {
			const {value, done} = await reader.read().catch(err => {
				console.log("error:", err)
				if (err.name === "AbortError") return {value: undefined, done: true}
				else throw err;
			});
			if (done) break;
			parser.feed(value);
		}

		console.log("finished receiving", messages[messages.length - 1].content);
		abortController = undefined;
	}
	
	function saveConversation() {
		if (messages.length === 0) return 
		messagesId = messagesId || Math.random().toString(36).substring(2);
		chatHistory[messagesId] = messages;
		localStorage.setItem('history', JSON.stringify(chatHistory));
	}

	function regenerateLastMessage() {
		prompt = messages[messages.length - 2].content
		console.log("regenerating last message:", prompt)
		messages = messages.slice(0, -2);
		console.log(messages);
		sendPromptStreamed();
	}

	$: prependSystemPrompt(systemPrompt)
	function prependSystemPrompt() {
		if (!systemPrompt) return;
		let msg = {role: 'system', content: systemPrompt};
		if (messages.length != 0 && messages[0].role === "system") messages[0] = msg;
		else messages = [msg, ...messages];
	}

	function editMessage(i: number) {
		prompt = messages[i].content;
		promptTextarea.focus();
		resizeTextarea();
		messages = messages.slice(0, i);
	}
	
</script>

<main>
	<div id="sidebar-div">
		<span><b>OpenAI api key:</b></span><input type="text" 
			bind:value={API_KEY}
			style="border-radius: 5px; margin: 5px; margin-bottom: 20px; ">

		<b>System prompt: </b>
		<textarea 
			id="system-prompt-input" 
			bind:value={systemPrompt}></textarea>

		<hr>
		<div class="setting">
			<span>Model:</span>
			<select style:display="inline-block" bind:value={promptParams.model}>
				{#each ['gpt-3.5-turbo', 'gpt-4'] as model}
					<option value={model}>{model}</option>
				{/each}
			</select>
		</div>
		<div class="setting">
			<span>Temperature:</span>
			<input style:display="inline-block" type="number" step="0.1" min="0" max="1" bind:value={promptParams.temperature} />
		</div>
		<div class="setting">
			<span>Max tokens:</span>
			<input style:display="inline-block" type="number" step="1" min="1" max="1000" bind:value={promptParams.max_tokens} />
		</div>

		
		{#if Object.keys(chatHistory).length !== 0}
		<hr>
		<div style:margin-top="10px">
			<b>History:</b>
			<History on:history-click={(e) => {messages = chatHistory[e.detail]; messagesId = e.detail}} {chatHistory}/>
		</div>
		<hr>
		{/if}
	</div>
	
	<div id="chat-div" bind:this={chatDiv}>
		{#if katexLoaded}
		{#each messages as msg, i (msg)}
			{#if msg.role !== 'system'}
			<div id="msg-container"> 
				<div bind:this={messageDivs[i]} class={msg.role + '-msg'}> 
					<span>
						{@html parseMessage(msg.content)} 
					</span>
				</div>
				{#if msg.role === 'user'}
				<div class="beside-usr-msg">
					<button on:click={() => editMessage(i)}>
						Edit
					</button>
				</div>
				{/if}
			</div>
			{/if}
		{/each}
		{/if}
		
		<div id="lower-btns-container">
			{#if messages.length !== 0}
			<button class="large-btn" on:click={saveConversation}>
				Save chat
			</button>
			<button class="large-btn" on:click={() => {messages = []; messagesId = null}}>
				Clear chat
			</button>
			{/if}
			
			{#if abortController}
			<button class="large-btn" id="abort-btn" on:click={() => abortController.abort()}>
				Stop generating
			</button>
			{/if}
			{#if !abortController && messages.length >= 2 &&  messages[messages.length - 1].role === 'assistant'}
			<button class="large-btn" id="continue-btn" on:click={regenerateLastMessage}>
				Regenerate last
			</button>
			{/if}
		</div>
		
		<textarea
			id="prompt-input" 
			bind:this={promptTextarea} 
			bind:value={prompt} 
			on:input={resizeTextarea}
			on:keydown={(e) => { if (e.ctrlKey && e.key === 'Enter') sendPromptStreamed() }}></textarea>
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
	main :global(code) {
		line-height: normal;
	}
	textarea, button {
		border-radius: 10px;
	}
	hr {
		display: block;
		height: 1px;
		border: 0;
		border-top: 1px solid $white;
		margin: 10px 0;
		padding: 0;
	}
	#sidebar-div {
		padding: 5px;
		margin: 0;
		flex: 0 0 300px;
		display: flex;
		flex-direction: column;
		line-height: 150%;
		background-color: $dark;
		color: #d9e0ee;
	}
	.setting {
		display: flex;
		justify-content: space-between;
		select, input {
			background-color: $white;
		}
	}
	.large-btn {
		width: fit-content;
		padding: 7px;
		margin-top: 10px;
		background-color: rgb(149, 241, 193);
		border: none;

		&:hover {
			background-color: rgba(55, 126, 11, 0.8);
			cursor: pointer;
		}
		&:active {
			background-color: rgb(255, 255, 255, 0.6);
		}
	}
	#chat-div {
		background-color: $white;
		color: $dark;
		padding-bottom: 120px;
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
	#lower-btns-container {
		position: fixed;
		bottom: 70px;
	}
	#prompt-input {
		font-size: 16px;
		font-family: 'Open Sans', sans-serif;
		margin: 10px;
		width: 50%;
		padding: 5px;
		margin-top: auto;
		resize: none;
		position: fixed;
		bottom: 0;
		outline: none;
		border: none;
		box-shadow: 0px 0px 10px 0px rgba(176, 175, 175, 0.75);

	}
	#system-prompt-input {
		font-size: 16px;
		font-family: 'Open Sans', sans-serif;
		margin: 5px;
		width: 95%;
		height: 20%;
		resize: none;
	}
	.beside-usr-msg {
		display: none;
		height: fit-content;
		margin-left: auto;
	}
	#msg-container {
		width: 100%;
		margin: 0;
		padding: 0;	
		display: flex;
		&:hover .beside-usr-msg{
			display: block;
		}
	}
	.user-msg, .assistant-msg, .error-msg {
		width: 65%;
		margin: 5px;
		padding: 10px;
		overflow-wrap: break-word;
		white-space: pre-wrap;
		line-height: 150%;
		display: flex;
	}
	.user-msg {
		margin-left: 10%;
		margin-right: auto;
		background-color: rgb(255, 255, 255);
		border-radius: 15px 15px 15px 0;
	}
	.assistant-msg {
		margin-right: 15%;
		margin-left: auto;
		background-color: rgb(204, 214, 214);
		border-radius: 15px 15px 0 15px;
	}
	.error-msg {
		background-color: rgb(185, 106, 106);
	}

</style>