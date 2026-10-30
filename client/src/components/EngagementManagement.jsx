import { useEffect, useState } from "react";
import api from "../api/axios";

function EngagementManagement() {
  const [clients, setClients] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [selectedServiceType, setSelectedServiceType] = useState("");
  const [form, setForm] = useState({
    clientId: "",
    templateId: "",
    name: "",
    periodStart: "",
    periodEnd: "",
  });
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [clientResponse, serviceResponse, engagementResponse] =
          await Promise.all([
            api.get("/clients", { params: { active: "true" } }),
            api.get("/service-types", { params: { active: "true" } }),
            api.get("/engagements"),
          ]);

        if (cancelled) return;

        setClients(clientResponse.data.clients);
        setServiceTypes(serviceResponse.data.serviceTypes);
        setEngagements(engagementResponse.data.engagements);

        if (serviceResponse.data.serviceTypes.length > 0) {
          setSelectedServiceType(
            String(serviceResponse.data.serviceTypes[0].id)
          );
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load engagement options"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedServiceType) return undefined;

    let cancelled = false;

    async function loadTemplates() {
      setTemplatesLoading(true);
      setError("");

      try {
        const response = await api.get("/task-templates", {
          params: {
            service_type_id: selectedServiceType,
            active: "true",
          },
        });

        if (!cancelled) {
          setTemplates(response.data.taskTemplates);
          setForm((currentForm) => ({
            ...currentForm,
            templateId: response.data.taskTemplates[0]
              ? String(response.data.taskTemplates[0].id)
              : "",
          }));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              "Unable to load task templates"
          );
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [selectedServiceType]);

  const serviceType = serviceTypes.find(
    (item) => String(item.id) === selectedServiceType
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await api.post("/engagements", {
        clientId: Number(form.clientId),
        serviceTypeId: Number(selectedServiceType),
        templateId: Number(form.templateId),
        name: form.name.trim(),
        engagementKind: serviceType.engagement_kind,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      });

      setEngagements((current) => [
        response.data.engagement,
        ...current,
      ]);
      setForm((currentForm) => ({ ...currentForm, name: "" }));
      setSuccess("Engagement created and template tasks generated.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to create engagement"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      className="dashboard-section engagement-management"
      aria-labelledby="engagement-management-title"
    >
      <div className="section-heading">
        <div>
          <h1 id="engagement-management-title">Engagements</h1>
          <p className="section-description">
            Create an engagement from an active service template. Template
            items generate tasks automatically.
          </p>
        </div>
      </div>

      {error && <p className="dashboard-error" role="alert">{error}</p>}
      {success && <p className="auth-success" role="status">{success}</p>}

      {loading ? (
        <p className="section-description">Loading engagement options…</p>
      ) : clients.length === 0 || serviceTypes.length === 0 ? (
        <p className="section-description">
          An active client and service type are required before creating an
          engagement.
        </p>
      ) : (
        <form className="form-card form-grid" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="engagement-client">Client</label>
            <select
              id="engagement-client"
              required
              value={form.clientId}
              onChange={(event) =>
                setForm({ ...form, clientId: event.target.value })
              }
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="engagement-service-type">Service type</label>
            <select
              id="engagement-service-type"
              required
              value={selectedServiceType}
              onChange={(event) => setSelectedServiceType(event.target.value)}
            >
              {serviceTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field field--wide">
            <label htmlFor="engagement-template">Task template</label>
            <select
              id="engagement-template"
              required
              disabled={templatesLoading || templates.length === 0}
              value={form.templateId}
              onChange={(event) =>
                setForm({ ...form, templateId: event.target.value })
              }
            >
              {templates.length === 0 ? (
                <option value="">No active templates for this service</option>
              ) : (
                templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (v{template.version})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="field field--wide">
            <label htmlFor="engagement-name">Engagement name</label>
            <input
              id="engagement-name"
              required
              maxLength={200}
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="engagement-period-start">Period start</label>
            <input
              id="engagement-period-start"
              type="date"
              required
              value={form.periodStart}
              onChange={(event) =>
                setForm({ ...form, periodStart: event.target.value })
              }
            />
          </div>
          <div className="field">
            <label htmlFor="engagement-period-end">Period end</label>
            <input
              id="engagement-period-end"
              type="date"
              required
              value={form.periodEnd}
              onChange={(event) =>
                setForm({ ...form, periodEnd: event.target.value })
              }
            />
          </div>
          <button
            className="button button--primary field--wide"
            type="submit"
            disabled={saving || templatesLoading || !form.templateId}
          >
            {saving ? "Creating…" : "Create engagement"}
          </button>
        </form>
      )}

      <section className="dashboard-section" aria-label="Engagement list">
        <div className="section-heading">
          <h2>Existing engagements</h2>
        </div>
        {loading ? (
          <p className="section-description">Loading engagements…</p>
        ) : engagements.length === 0 ? (
          <p className="section-description">No engagements found.</p>
        ) : (
          <div className="engagement-management__list">
            {engagements.map((engagement) => (
              <article
                className="engagement-management__row"
                key={engagement.id}
              >
                <strong>{engagement.name}</strong>
                <span>{engagement.client_name}</span>
                <span>{engagement.status}</span>
                <span>
                  {engagement.period_start} – {engagement.period_end}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default EngagementManagement;
