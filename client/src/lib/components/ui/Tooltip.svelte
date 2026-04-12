<script>
  export let text = '';
  let visible = false;
  let timer;

  function show() { timer = setTimeout(() => visible = true, 200); }
  function hide() { clearTimeout(timer); visible = false; }
</script>

<span
  class="tooltip-wrapper"
  on:mouseenter={show}
  on:mouseleave={hide}
  on:touchstart|preventDefault={() => { visible = !visible; }}
>
  <slot />
  {#if visible && text}
    <div class="tooltip-box">{text}</div>
  {/if}
</span>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }
  .tooltip-box {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: .5rem .75rem;
    font-size: .8rem;
    color: var(--color-text);
    white-space: pre-wrap;
    max-width: 280px;
    min-width: 120px;
    z-index: 100;
    box-shadow: 0 4px 16px rgba(0,0,0,.5);
    pointer-events: none;
    line-height: 1.5;
  }
</style>
