<script lang="ts">
	import sanitizeHtml from 'sanitize-html';
	import { onMount } from 'svelte';

	const promptParams = {
		'model': 'gpt-3.5-turbo',
		'max_tokens': 200,
		'temperature': 1,
		'stream': false,
	}
	$: console.log(promptParams);

	console.log("DEV")

	let promptTextarea;
	let prompt = "";
	let systemPrompt = ""
	let messages = [];
	
	onMount(() => {
		promptTextarea.style.height = 'auto';
		promptTextarea.focus();
	});

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
		console.log(json);
		const content = json.choices[0].message.content.trim();
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
	
	<div id="chat-div">
		{#each messages as msg}
			{#if msg.role !== 'system'}
			<div id="msg-container">
				<div class={msg.role + '-msg'}> 
					<!-- Add line breaks to output -->
					{@html sanitizeHtml(msg.content.replace(/\n/g, '<br>'), { allowedTags: ['br'] })} 
				</div>
			</div>
			{/if}
		{/each}
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
		flex: 1;
		display: flex;
		flex-direction: column;
		// justify-content: center;
		align-items: center;
	}
	#prompt-input {
		font-size: 16px;
		font-family: 'Open Sans', sans-serif;
		margin: 10px;
		width: 80%;
		height: 20%;
		margin-top: auto;
		resize: none;
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
		width: 90%;
		margin: 0;
		padding: 0;	
	}
	.user-msg, .assistant-msg, .error-msg {
		margin: 5px;
		padding: 10px;
		border-radius: 10px;
		overflow-wrap: break-word;
	}
	.user-msg {
		background-color: rgb(255, 255, 255);
	}
	.assistant-msg {
		background-color: rgb(204, 214, 214);
	}
	.error-msg {
		background-color: rgb(185, 106, 106);
	}
</style>