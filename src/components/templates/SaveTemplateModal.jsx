import { useRef, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Field";
import { plural } from "../../utils/format";

const PROBLEMS = {
  empty: "Add some items first: a template needs something to copy.",
  "too-big": "This list is too big to save as a template.",
  "too-deep": "This list is nested too deeply to save as a template.",
  missing: "That list could not be found.",
};

// The form only mounts while the modal is open, so it starts fresh every time.
function SaveForm({ list, onClose, onSave, inputRef }) {
  const [name, setName] = useState(list.title);
  const [error, setError] = useState("");
  const nested = list.items.filter((i) => i.parent_id).length;

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the template a name.");
      inputRef.current?.focus();
      return;
    }
    const result = onSave(name.trim());
    if (result.ok) onClose();
    else setError(PROBLEMS[result.reason] || "Could not save the template.");
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-4">
      <Input
        ref={inputRef}
        label="Template name"
        value={name}
        maxLength={200}
        error={error}
        onChange={(e) => {
          setName(e.target.value);
          if (error) setError("");
        }}
      />
      <p className="text-[13px] text-muted">
        Saves {plural(list.items.length, "item")}
        {nested > 0 ? ` (${nested} of them nested)` : ""}, plus the icon and
        colour. Ticks are not saved, so every new list starts fresh.
      </p>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" variant="primary">
          Save template
        </Button>
      </div>
    </form>
  );
}

export function SaveTemplateModal({ open, onClose, list, onSave }) {
  const inputRef = useRef(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Save as template"
      description="Keep this list’s items so you can start new lists from them."
      initialFocus={inputRef}
    >
      <SaveForm
        list={list}
        onClose={onClose}
        onSave={onSave}
        inputRef={inputRef}
      />
    </Modal>
  );
}
