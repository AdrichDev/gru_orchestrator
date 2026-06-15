# Spec: Agent Wizard Widget Configuration

## Requirements

### Sector Catalog

- The system SHALL expose paginated sectors with 9 items per page by default.
- The system SHALL always include `Otro` in sector selection.
- The system SHALL sort sectors alphabetically when more than one page exists.
- The system SHALL allow adding a new sector globally.
- The UI SHALL show an input with placeholder `Introduce el Sector` when `Otro` is selected.
- The add-sector button SHALL be disabled until a non-empty sector is entered.
- The UI SHALL show `Añadiendo...`, `Añadido correctamente`, and `Error al ingresar el sector` states.

### Wizard

- The wizard SHALL be composed of reusable step components and hooks.
- Sector labels SHALL be capitalized.
- Sector cards SHALL use the existing dark theme and lighten on hover.
- The prompt step SHALL generate a complete sector-specific prompt before the user calls AI improvement.
- AI prompt improvement SHALL expand and improve the current prompt.
- The skills step SHALL allow filtering marketplace skills by name and category and selecting existing skills.

### Widget Configuration

- Agents SHALL persist primary color, secondary color, avatar emoji, avatar Base64 image, and template config.
- The widget configuration UI SHALL accept HEX/RGB values and native color picker input.
- The embeddable widget SHALL display the configured avatar or the default robot emoji.
- The widget header SHALL display the real agent name.

### Knowledge Duplicates

- The system SHALL detect duplicates by `agentId + source + content`.
- If duplicates are detected and no duplicate policy is supplied, the API SHALL ask for confirmation.
- If overwrite is true, the system SHALL replace existing duplicate chunks.
- If overwrite is false, the system SHALL save duplicated chunks under incremented source suffixes such as `_1`.

### Lead Capture

- The system SHALL store leads in a dedicated `Lead` model.
- The chatbot SHALL first ask for the customer's name.
- After responding to the customer's request, the chatbot SHALL ask whether a team member should contact them.
- If the customer accepts contact, the bot SHALL collect email and phone, save a lead, ask if anything else is needed, and then close politely.
- If the customer declines contact, the bot SHALL close normally.

