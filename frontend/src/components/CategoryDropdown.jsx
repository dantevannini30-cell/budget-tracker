import { useState, useRef, useEffect } from "react";

export default function CategoryDropdown({
  transactions,
  selectedCategories,
  onChange,
  placeholder = "Select categories...",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Get all unique categories from transactions
  const allCategories = [
    ...new Set(
      transactions
        .map((t) => t.category)
        .filter(Boolean)
        .filter((cat) => cat !== "Uncategorized")
    ),
  ].sort();

  // Filter categories based on search
  const filteredCategories = searchValue.trim()
    ? allCategories.filter((cat) =>
        cat.toLowerCase().includes(searchValue.toLowerCase())
      )
    : allCategories;

  // Add current search value as option if it's not already in the list
  const showCreateOption = searchValue.trim() &&
    !filteredCategories.includes(searchValue.trim()) &&
    !selectedCategories.includes(searchValue.trim());

  const options = showCreateOption
    ? [...filteredCategories, searchValue.trim()]
    : filteredCategories;

  // Handle clicking outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchValue("");
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    setSearchValue(e.target.value);
    setHighlightedIndex(-1);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : options.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          selectCategory(options[highlightedIndex]);
        } else if (searchValue.trim()) {
          selectCategory(searchValue.trim());
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchValue("");
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case "Backspace":
        if (!searchValue && selectedCategories.length > 0) {
          // Remove last selected category
          const newCategories = selectedCategories.slice(0, -1);
          onChange(newCategories);
        }
        break;
    }
  };

  const selectCategory = (category) => {
    if (!selectedCategories.includes(category)) {
      onChange([...selectedCategories, category]);
    }
    setSearchValue("");
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const removeCategory = (categoryToRemove) => {
    onChange(selectedCategories.filter((cat) => cat !== categoryToRemove));
  };

  const inputStyle = {
    background: "var(--surface2)",
    border: "1px solid var(--border2)",
    borderRadius: 2,
    padding: "8px 12px",
    color: "var(--text)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          padding: "8px 12px",
          background: "var(--surface2)",
          border: "1px solid var(--border2)",
          borderRadius: 2,
          minHeight: 40,
          alignItems: "center",
          cursor: "text",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {selectedCategories.map((category) => (
          <span
            key={category}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "var(--accent)",
              color: "var(--bg)",
              padding: "2px 6px",
              borderRadius: 2,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {category}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCategory(category);
              }}
              style={{
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                padding: 0,
                fontSize: 12,
                lineHeight: 1,
                opacity: 0.8,
              }}
              onMouseEnter={(e) => (e.target.style.opacity = 1)}
              onMouseLeave={(e) => (e.target.style.opacity = 0.8)}
            >
              ×
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedCategories.length === 0 ? placeholder : ""}
          style={{
            ...inputStyle,
            border: "none",
            background: "transparent",
            padding: 0,
            minWidth: selectedCategories.length === 0 ? 120 : 60,
            outline: "none",
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 2,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1000,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "12px",
                color: "var(--muted2)",
                fontSize: 12,
                textAlign: "center",
              }}
            >
              No categories found
            </div>
          ) : (
            options.map((category, index) => (
              <div
                key={category}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background:
                    highlightedIndex === index
                      ? "var(--surface2)"
                      : "transparent",
                  color: "var(--text)",
                  fontSize: 12,
                  borderBottom:
                    index < options.length - 1
                      ? "1px solid var(--border2)"
                      : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseLeave={() => setHighlightedIndex(-1)}
                onClick={() => selectCategory(category)}
              >
                {showCreateOption && index === options.length - 1 ? (
                  <>
                    <span style={{ color: "var(--accent)" }}>+</span>
                    Create "{category}"
                  </>
                ) : (
                  category
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}