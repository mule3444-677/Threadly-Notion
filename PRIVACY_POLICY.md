# Privacy Policy for Threadly

**Last Updated:** [Date of Last Update, e.g., October 26, 2023]

Thank you for using Threadly! Your privacy is critically important to us. This policy outlines how Threadly collects, uses, and handles your data.

The short version is: **Threadly is designed to be a private, local-first tool. Your data is your own, and it never leaves your computer.**

---

### 1. The "Single Purpose" Philosophy

Threadly has a single purpose: to turn your ephemeral AI chats into a permanent, personal knowledge base that lives on your own machine. Our data practices are guided by this "local-first" principle.

---

### 2. What Data We Collect and Why

Threadly exclusively uses the `chrome.storage` API, which means all data is stored locally in your browser's secure storage area. We do **not** have a server, and we do **not** transmit your data anywhere.

The data we store locally includes:

*   **Pinned Messages:** The text and metadata of messages you explicitly choose to save from AI chat websites. This is the core content of your personal knowledge base.
*   **Collections and Notes:** The names of the collections you create and any personal notes you add to your pinned messages. This allows you to organize and add context to your knowledge base.
*   **User Settings:** Your preferences for the extension, such as the sidebar position or default view. This is to provide a consistent user experience.

This data is essential for the extension to function. Without it, Threadly would not be able to save or organize your information.

---

### 3. Data We Do **NOT** Collect

To be perfectly clear, we **never** collect, store, or transmit:

*   **Personal Information:** Your name, email address, IP address, or any other personally identifiable information.
*   **Browsing History:** We do not track the websites you visit. The extension only activates on the specific AI chat websites listed in its host permissions.
*   **Analytics or Telemetry:** We do not use any tracking scripts or analytics tools to monitor your usage of the extension.
*   **Full Conversation Data:** Threadly only reads conversation data on the page to provide its navigation and pinning features. It only *saves* the specific messages you choose to pin.

---

### 4. How We Use Permissions

Threadly requires two key permissions to function, and we use them with the principle of "least privilege":

*   **`storage`:** As explained above, this is used to save your data locally on your computer.
*   **`host_permissions`:** This permission is required to add the Threadly sidebar to the AI chat websites you use (e.g., `chat.openai.com`, `claude.ai`). This allows the extension to read the conversation on the page for navigation and to allow you to pin messages. The extension does not interact with any other websites.

---

### 5. Your Control Over Your Data

You have complete control over your data. Because everything is stored locally, you can manage it at any time:

*   You can **delete** individual pinned messages or entire collections from within the extension's interface.
*   You can **export** your data using the features provided in the extension.
*   You can **erase all data** associated with the extension by uninstalling it. When you remove Threadly from your browser, all of its locally stored data is permanently deleted.

---

### 6. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. If we make significant changes, we will notify users through the extension's interface or its Chrome Web Store listing. We encourage you to review this policy periodically.

---

### 7. Contact Us

If you have any questions or concerns about this Privacy Policy, please feel free to open an issue on our GitHub repository or contact us at [Your Email Address or a link to your GitHub profile].
