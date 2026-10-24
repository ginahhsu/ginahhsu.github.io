#!/bin/sh
# Double-click to edit the site's text and spacing in your browser.
# Saves go straight into the HTML/CSS files; Publish commits and pushes.
# Close this Terminal window to stop the editor.
cd "$(dirname "$0")" || exit 1
exec python3 tools/edit-server.py
