import { useEffect, useState } from "react";
import api from "../api/axios";

const EMPTY_CLIENT = { name: "", email: "", phone: "" };
const EMPTY_SERVICE = {
  name: "",
  description: "",
  engagement_kind: "ONE_TIME",
  recurrence_interval: "",
};
const EMPTY_TEMPLATE = { service_type_id: "", name: "", version: "1" };

function getErrorMessage(error, fallback) {
  return (
    error.response?.data?.message ||
    error.message ||
    fallback
  );
}

function CatalogManagement() {
  const [section, setSection] = useState("clients");
  const [clients, setClients] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [templateItems, setTemplateItems] = useState("");
  const [existingTemplateItems, setExistingTemplateItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function loadCatalog() {
    return Promise.all([
      api.get("/clients"),
      api.get("/service-types"),
      api.get("/task-templates"),
    ]);
  }

  useEffect(() => {
    let cancelled = false;

    loadCatalog()
      .then(([clientResponse, serviceResponse, templateResponse]) => {
        if (cancelled) return;
        setClients(clientResponse.data.clients);
        setServiceTypes(serviceResponse.data.serviceTypes);
        setTemplates(templateResponse.data.taskTemplates);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(getErrorMessage(requestError, "Unable to load catalog"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function resetEditor() {
    setEditing(null);
    setEditorOpen(false);
    setClientForm(EMPTY_CLIENT);
    setServiceForm(EMPTY_SERVICE);
    setTemplateForm(EMPTY_TEMPLATE);
    setTemplateItems("");
    setExistingTemplateItems([]);
  }

  function beginCreate() {
    resetEditor();
    setEditorOpen(true);
    setError("");
    setSuccess("");

    if (section === "templates" && serviceTypes.length > 0) {
      const serviceTypeId = String(serviceTypes[0].id);
      const nextVersion =
        Math.max(
          0,
          ...templates
            .filter(
              (template) =>
                String(template.service_type_id) === serviceTypeId
            )
            .map((template) => Number(template.version))
        ) + 1;
      setTemplateForm({
        service_type_id: serviceTypeId,
        name: "",
        version: String(nextVersion),
      });
    }
  }

  async function beginEdit(item) {
    setEditing(item.id);
    setEditorOpen(true);
    setError("");
    setSuccess("");

    if (section === "clients") {
      setClientForm({
        name: item.name,
        email: item.email || "",
        phone: item.phone || "",
      });
    } else if (section === "services") {
      setServiceForm({
        name: item.name,
        description: item.description || "",
        engagement_kind: item.engagement_kind,
        recurrence_interval: item.recurrence_interval || "",
      });
    } else {
      try {
        const response = await api.get(`/task-templates/${item.id}`);
        const template = response.data.taskTemplate;
        setTemplateForm({
          service_type_id: String(template.service_type_id),
          name: template.name,
          version: String(template.version),
        });
        setExistingTemplateItems(template.items);
        setTemplateItems(
          template.items
            .map(
              (templateItem) =>
                `${templateItem.title} | ${templateItem.due_days_after_start}`
            )
            .join("\n")
        );
      } catch (requestError) {
        setEditing(null);
        setError(
          getErrorMessage(requestError, "Unable to load template items")
        );
      }
    }
  }

  function parseTemplateItems() {
    const lines = templateItems.split(/\r?\n/).filter((line) => line.trim());
    const oldItems = editing
      ? existingTemplateItems
      : [];

    return lines.map((line, index) => {
      const [rawTitle, rawDays = "0"] = line.split("|");
      const item = {
        title: rawTitle.trim(),
        sequence_no: index + 1,
        due_days_after_start: Number(rawDays.trim()),
      };

      if (oldItems[index]) item.id = oldItems[index].id;
      return item;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (section === "clients") {
        const response = editing
          ? await api.put(`/clients/${editing}`, clientForm)
          : await api.post("/clients", clientForm);
        setClients((current) =>
          editing
            ? current.map((item) =>
                item.id === editing ? response.data.client : item
              )
            : [...current, response.data.client]
        );
      } else if (section === "services") {
        const payload = {
          ...serviceForm,
          recurrence_interval:
            serviceForm.engagement_kind === "RECURRING"
              ? serviceForm.recurrence_interval
              : null,
        };
        const response = editing
          ? await api.put(`/service-types/${editing}`, payload)
          : await api.post("/service-types", payload);
        setServiceTypes((current) =>
          editing
            ? current.map((item) =>
                item.id === editing ? response.data.serviceType : item
              )
            : [...current, response.data.serviceType]
        );
      } else {
        const items = parseTemplateItems();
        const payload = {
          service_type_id: Number(templateForm.service_type_id),
          name: templateForm.name,
          version: Number(templateForm.version),
          items,
        };
        const response = editing
          ? await api.put(`/task-templates/${editing}`, payload)
          : await api.post("/task-templates", payload);
        setTemplates((current) =>
          editing
            ? current.map((item) =>
                item.id === editing ? response.data.taskTemplate : item
              )
            : [response.data.taskTemplate, ...current]
        );
      }

      setSuccess(editing ? "Catalog item updated." : "Catalog item created.");
      resetEditor();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to save catalog item"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item) {
    setError("");
    setSuccess("");

    try {
      const endpoint =
        section === "clients"
          ? `/clients/${item.id}/status`
          : section === "services"
            ? `/service-types/${item.id}/status`
            : `/task-templates/${item.id}/status`;
      const response = await api.patch(endpoint, {
        [section === "templates" ? "is_active" : "isActive"]: !item.is_active,
      });
      const updateList = (current) =>
        current.map((entry) =>
          entry.id === item.id
            ? section === "clients"
              ? response.data.client
              : section === "services"
                ? response.data.serviceType
                : response.data.taskTemplate
            : entry
        );

      if (section === "clients") setClients(updateList);
      if (section === "services") setServiceTypes(updateList);
      if (section === "templates") setTemplates(updateList);
      setSuccess("Status updated.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Unable to update status"));
    }
  }

  const items =
    section === "clients"
      ? clients
      : section === "services"
        ? serviceTypes
        : templates;

  return (
    <section className="dashboard-section" aria-labelledby="catalog-title">
      <div className="section-heading">
        <div>
          <h1 id="catalog-title">Clients, services &amp; templates</h1>
          <p className="section-description">
            Manage the reference data and task templates used by engagements.
          </p>
        </div>
      </div>

      <div className="user-management__actions" aria-label="Catalog sections">
        {[
          ["clients", "Clients"],
          ["services", "Service types"],
          ["templates", "Task templates"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={
              section === value ? "button button--primary" : "button button--quiet"
            }
            type="button"
            onClick={() => {
              resetEditor();
              setSection(value);
            }}
          >
            {label}
          </button>
        ))}
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            loadCatalog()
              .then(([clientResponse, serviceResponse, templateResponse]) => {
                setClients(clientResponse.data.clients);
                setServiceTypes(serviceResponse.data.serviceTypes);
                setTemplates(templateResponse.data.taskTemplates);
              })
              .catch((requestError) => {
                setError(
                  getErrorMessage(requestError, "Unable to load catalog")
                );
              })
              .finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {success && <p className="auth-success" role="status">{success}</p>}

      {!editing && (
        <button
          className="button button--primary"
          type="button"
          onClick={beginCreate}
        >
          {section === "clients"
            ? "Create client"
            : section === "services"
              ? "Create service type"
              : "Create task template"}
        </button>
      )}

      {editorOpen && (
        <form className="form-card catalog-editor" onSubmit={handleSubmit}>
          <h2>{editing ? "Edit item" : "Create item"}</h2>
          {section === "clients" && (
            <div className="form-grid">
              <label className="field">
                Name
                <input
                  required
                  maxLength={150}
                  value={clientForm.name}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Email
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, email: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Phone
                <input
                  maxLength={30}
                  value={clientForm.phone}
                  onChange={(event) =>
                    setClientForm({ ...clientForm, phone: event.target.value })
                  }
                />
              </label>
            </div>
          )}
          {section === "services" && (
            <div className="form-grid">
              <label className="field">
                Name
                <input
                  required
                  maxLength={150}
                  value={serviceForm.name}
                  onChange={(event) =>
                    setServiceForm({ ...serviceForm, name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Engagement kind
                <select
                  value={serviceForm.engagement_kind}
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      engagement_kind: event.target.value,
                      recurrence_interval:
                        event.target.value === "RECURRING"
                          ? serviceForm.recurrence_interval
                          : "",
                    })
                  }
                >
                  <option value="ONE_TIME">One time</option>
                  <option value="RECURRING">Recurring</option>
                </select>
              </label>
              {serviceForm.engagement_kind === "RECURRING" && (
                <label className="field">
                  Recurrence interval
                  <select
                    required
                    value={serviceForm.recurrence_interval}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        recurrence_interval: event.target.value,
                      })
                    }
                  >
                    <option value="">Select an interval</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </label>
              )}
              <label className="field field--wide">
                Description
                <textarea
                  value={serviceForm.description}
                  onChange={(event) =>
                    setServiceForm({
                      ...serviceForm,
                      description: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          )}
          {section === "templates" && (
            <div className="form-grid">
              <label className="field">
                Service type
                <select
                  required
                  value={templateForm.service_type_id}
                  onChange={(event) =>
                    setTemplateForm({
                      ...templateForm,
                      service_type_id: event.target.value,
                    })
                  }
                >
                  <option value="">Select a service type</option>
                  {serviceTypes
                    .filter((service) => service.is_active)
                    .map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Template name
                <input
                  required
                  maxLength={150}
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm({ ...templateForm, name: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Version
                <input
                  type="number"
                  min="1"
                  required
                  value={templateForm.version}
                  onChange={(event) =>
                    setTemplateForm({
                      ...templateForm,
                      version: event.target.value,
                    })
                  }
                />
              </label>
              <label className="field field--wide">
                Template items (one per line: title | due days after start)
                <textarea
                  required
                  value={templateItems}
                  onChange={(event) => setTemplateItems(event.target.value)}
                  placeholder={"Prepare source documents | 3\nReview documents | 7"}
                />
                <span className="field-hint">
                  Existing template items are retained to preserve generated
                  task references; edit or add items here.
                </span>
              </label>
            </div>
          )}
          <div className="user-management__actions">
            <button className="button button--primary" type="submit" disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create"}
            </button>
            <button
              className="button button--quiet"
              type="button"
              onClick={resetEditor}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="section-description">Loading catalog…</p>
      ) : items.length === 0 ? (
        <p className="section-description">No catalog items found.</p>
      ) : (
        <div className="user-management__list">
          {items.map((item) => {
            const active = Boolean(item.is_active);
            const title =
              section === "templates"
                ? `${item.name} (v${item.version})`
                : item.name;
            return (
              <article className="user-management__row" key={item.id}>
                <div className="user-management__identity">
                  <strong>{title}</strong>
                  <span>
                    {section === "clients"
                      ? item.email || item.phone || "No contact details"
                      : section === "services"
                        ? item.engagement_kind
                        : serviceTypes.find(
                            (service) =>
                              Number(service.id) ===
                              Number(item.service_type_id)
                          )?.name || "Service type"}
                  </span>
                  <small>{active ? "Active" : "Inactive"}</small>
                </div>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={Boolean(editing)}
                  onClick={() => beginEdit(item)}
                >
                  Edit
                </button>
                <button
                  className="button button--quiet"
                  type="button"
                  disabled={Boolean(editing)}
                  onClick={() => toggleActive(item)}
                >
                  {active ? "Deactivate" : "Activate"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default CatalogManagement;
