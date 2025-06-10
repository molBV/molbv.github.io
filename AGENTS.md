Codex Agents Configuration

This document provides guidance for Codex when generating or editing code in this HTML5 game project.

Project Structure

Entry Point: index.html at the repository root

Assets: All images, audio, sprites under the assets/ directory (e.g., assets/boss_animation/)

External Imports: Use ES module imports via <script type="module"> (Firebase, analytics)


HTML & CSS

Styling lives entirely in the inline <style> block at the top of index.html

Indentation: 2 spaces; no trailing spaces

ID Naming: camelCase (e.g., gameCanvas, btnAdventure)

Class Naming: kebab-case (e.g., menu-btn, iconBounce)

Adding Styles: Append new rules in the <style> block, following existing grouping and comments


JavaScript Conventions

Location: Single <script type="module"> at the bottom of index.html

Indentation: 2 spaces; always use semicolons

Variable/Function Names: camelCase

Constants: UPPER_SNAKE_CASE (e.g., ORIGINAL_WIDTH, STATE)

Section Separators: Preserve and follow the existing // ── Section Name ── comment style

Ordering: Maintain load order: polyfills/libraries → Firebase setup → helper functions → game loop


Assets

Filenames: descriptive, lowercase or camelCase matching code references

Paths: always use relative paths (assets/...)

Organization: keep subfolders for logical groupings (e.g., boss_animation, jellyfish)


Git & Pull Requests

Commit Messages: imperative mood, prefixed by scope, e.g.,

Game: Add triple rocket power-up

UI: Update score display formatting


Issue References: include ticket/issue numbers if applicable, e.g., (#42)

PR Descriptions: include summary of changes, motivation, and testing notes

Focus: one feature or bug fix per PR


Codex Overrides

Do Not extract inline CSS into external files

Do Not split the main script into multiple files without explicit instruction

Do respect existing code structure and naming conventions when suggesting edits
