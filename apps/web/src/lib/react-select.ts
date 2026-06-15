import { StylesConfig } from 'react-select';

export const globalSelectStyles: StylesConfig<any, any, any> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: 'var(--background)',
    borderColor: state.isFocused ? 'var(--accent-foreground)' : 'var(--border)',
    borderRadius: '0.5rem',
    padding: '2px',
    fontSize: '0.875rem',
    color: 'var(--foreground)',
    boxShadow: 'none',
    transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
    '&:hover': {
      borderColor: 'var(--accent-foreground)',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: '2px 12px',
  }),
  placeholder: (base) => ({
    ...base,
    color: 'var(--muted-foreground)',
    fontWeight: '500',
  }),
  singleValue: (base) => ({
    ...base,
    color: 'var(--foreground)',
    fontWeight: '600',
  }),
  input: (base) => ({
    ...base,
    color: 'var(--foreground)',
    margin: 0,
    padding: 0,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'var(--card)',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--border)',
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: 0,
    maxHeight: '250px',
  }),
  group: (base) => ({
    ...base,
    padding: 0,
  }),
  groupHeading: (base) => ({
    ...base,
    color: 'var(--foreground)',
    fontWeight: '600',
    fontSize: '0.75rem',
    textTransform: 'none',
    padding: '8px 12px 4px',
    margin: 0,
    backgroundColor: 'var(--muted)',
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? 'var(--accent)'
      : state.isFocused
      ? 'var(--accent)'
      : 'transparent',
    color: state.isSelected || state.isFocused
      ? 'var(--accent-foreground)'
      : state.isDisabled
      ? 'var(--muted-foreground)'
      : 'var(--foreground)',
    cursor: state.isDisabled ? 'not-allowed' : 'pointer',
    padding: '8px 12px',
    opacity: state.isDisabled ? 0.5 : 1,
    transition: 'background-color 0.1s ease, color 0.1s ease',
    '&:active': {
      backgroundColor: 'var(--accent)',
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  }),
  loadingMessage: (base) => ({
    ...base,
    color: 'var(--muted-foreground)',
    fontSize: '0.875rem',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: 'var(--muted)',
    borderRadius: '0.375rem',
    border: '1px solid var(--border)',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: 'var(--foreground)',
    fontWeight: '700',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: 'var(--muted-foreground)',
    ':hover': {
      backgroundColor: 'var(--accent)',
      color: 'var(--accent-foreground)',
    },
  }),
};
