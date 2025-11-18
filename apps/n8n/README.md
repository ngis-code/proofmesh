# ProofMesh n8n Integration (v1 placeholder)

This folder is a placeholder for future n8n-related configuration and documentation.

In v1, n8n is **optional** and is not part of the core request flow or any load balancing logic. Instead, it is intended for:

- Listening to external events (e.g., Google Drive, S3, email, webhooks).
- Calling the ProofMesh API `/api/stamp` endpoint with a pre-computed hash and `orgId`.

## Example Workflow (Conceptual)

An example n8n workflow could look like:

1. **HTTP Trigger** or **Cloud Storage Trigger**  
   Receive a notification that a new file has been uploaded.
2. **Custom Function / External Service**  
   Compute the file's hash (e.g., `SHA256:<hex>`). This can happen outside n8n (e.g., in your storage pipeline) with n8n only receiving the hash.
3. **HTTP Request Node → ProofMesh API**  
   Call:

   - `POST /api/stamp`
   - Body:

     ```json
     {
       "orgId": "UUID",
       "hash": "SHA256:<hex>",
       "artifactType": "file"
     }
     ```

4. **Optional Notifications**  
   Send a Slack/email notification with the `proofId` and status.

In future versions, this folder can contain exported n8n workflow JSON files or helper scripts, but for now it exists primarily as documentation.


