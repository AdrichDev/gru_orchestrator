# Proposal: Agent Wizard Widget Configuration SDD

## Problem

The current agent creation flow is mostly hardcoded in a single page, with fixed sectors, limited skill selection, minimal widget configuration, and no structured lead capture. Knowledge ingestion also stores duplicate chunks without asking the user how to handle them.

## Proposed Change

Improve the agent wizard, widget configuration, sector catalog, knowledge ingestion, and chatbot lead flow:

- Add persistent sectors with pagination and "Otro" support.
- Split the wizard into reusable components and hooks.
- Add marketplace-style skill filtering in the wizard.
- Persist widget colors, avatar, and template configuration on the agent.
- Serve widget configuration to the embeddable widget.
- Add duplicate detection for knowledge chunks with overwrite/suffix behavior.
- Add a controlled lead capture flow backed by a `Lead` model.

## Outcomes

- Agents can be configured with branded widget appearance.
- Users can add and reuse custom sectors globally.
- The widget displays the real chatbot name and selected avatar.
- Knowledge ingestion avoids accidental duplicate chunks.
- Human handoff requests are stored as structured leads.

