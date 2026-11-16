# Todo App

A simple, dependency-free todo app (HTML/CSS/JS). Data is stored in the browser's localStorage.

## Features
- Add todos with an optional due date (overdue and due-today are highlighted)
- Check off todos; "mark all" checkbox toggles everything
- Edit with the ✎ button: Enter saves, Esc cancels
- Delete with × (Undo available for 6 seconds, also after Clear completed)
- Priorities (Low/Medium/High): set when adding, change with the ⚑ button
- Old v1 todos are migrated automatically
- Filter: All / Active / Done, plus live search (press `/` to focus it)
- Clear completed
- Dark mode (toggle, remembered; defaults to your system setting)
- Keyboard-accessible, responsive, respects reduced-motion

## Run
Open `index.html` in a browser, or serve the folder: `python3 -m http.server 8000`.
