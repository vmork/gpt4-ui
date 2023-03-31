<script>
    import { createEventDispatcher } from "svelte";

    export let chatHistory;

    const dispatch = createEventDispatcher();

    function handleClick(id) {
        dispatch("history-click", id)
    }
</script>

<div id="container">
    {#each Object.entries(chatHistory) as [id, messages], i}
    <div class="history-item">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div on:click={() => handleClick(id)}>
            {i+1}: {messages[0].content.slice(0, 30) + '...'}
        </div>
    </div>
    {/each}
</div>

<style lang="scss">
    #container {
        display: flex;
        color: #d9e0ee;
        flex-direction: column;
        overflow: scroll;
        &::-webkit-scrollbar {
            display: none;
        }
    }

    .history-item {
        flex: 1 0 auto;
        padding: 5px;
        &:hover {
            cursor: pointer;
            background-color: rgb(46, 56, 62);
        }
    }
</style>
