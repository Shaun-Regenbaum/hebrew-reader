export function Nav(props: { on: 'read' | 'review' | 'words' }) {
  return (
    <nav class="nav" aria-label="Main">
      <a href="#/" classList={{ on: props.on === 'read' }}>Read</a>
      <a href="#/review" classList={{ on: props.on === 'review' }}>Review</a>
      <a href="#/words" classList={{ on: props.on === 'words' }}>Words</a>
    </nav>
  );
}
