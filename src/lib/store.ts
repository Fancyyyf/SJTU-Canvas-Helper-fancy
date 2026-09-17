import { PayloadAction, configureStore, createSlice } from "@reduxjs/toolkit";
import { AppConfig, TermSelection } from "./model";

const TERM_FILTER_STORAGE_KEY = "canvas-helper.selected-term";
const SIDEBAR_ITEMS_STORAGE_KEY = "canvas-helper.sidebar-items";

export const DEFAULT_SIDEBAR_ITEM_KEYS = [
    "agent",
    "attendance",
    "files",
    "assignments",
    "discussions",
    "calendar",
    "users",
    "grades",
    "submissions",
    "syllabus",
    "video",
    "qrcode",
    "annual",
    "settings",
];

function readStoredTermSelection(): TermSelection {
    if (typeof localStorage === "undefined") return null;
    try {
        const value = localStorage.getItem(TERM_FILTER_STORAGE_KEY);
        if (value === "all") return "all";
        if (value !== null) {
            const termId = Number.parseInt(value, 10);
            if (termId > 0) return termId;
        }
    } catch {
        // Local storage can be unavailable in restricted WebViews.
    }
    return null;
}

function readStoredSidebarItems(): string[] {
    if (typeof localStorage === "undefined") return DEFAULT_SIDEBAR_ITEM_KEYS;
    try {
        const value = localStorage.getItem(SIDEBAR_ITEMS_STORAGE_KEY);
        if (value === null) return DEFAULT_SIDEBAR_ITEM_KEYS;
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return DEFAULT_SIDEBAR_ITEM_KEYS;
        const validKeys = parsed.filter(
            (key): key is string =>
                typeof key === "string" && DEFAULT_SIDEBAR_ITEM_KEYS.includes(key)
        );
        return Array.from(new Set(validKeys));
    } catch {
        return DEFAULT_SIDEBAR_ITEM_KEYS;
    }
}

const configInitialState: {
    data: AppConfig | null
} = {
    data: null,
}

export const configSlice = createSlice({
    name: 'config',
    initialState: configInitialState,
    reducers: {
        updateConfig: (state, action: PayloadAction<AppConfig>) => {
            state.data = action.payload;
        },
    }
});

export interface CourseState {
    selectedCourseId: number;
}

const courseInitialState: CourseState = {
    selectedCourseId: -1,
};

export const courseSlice = createSlice({
    name: 'course',
    initialState: courseInitialState,
    reducers: {
        setSelectedCourseId: (state, action: PayloadAction<number>) => {
            state.selectedCourseId = action.payload;
        },
    }
});

const termInitialState: { selectedTermId: TermSelection } = {
    selectedTermId: readStoredTermSelection(),
};

export const termSlice = createSlice({
    name: "term",
    initialState: termInitialState,
    reducers: {
        setSelectedTermId: (state, action: PayloadAction<TermSelection>) => {
            state.selectedTermId = action.payload;
        },
    },
});

const navigationInitialState: { visibleItemKeys: string[] } = {
    visibleItemKeys: readStoredSidebarItems(),
};

export const navigationSlice = createSlice({
    name: "navigation",
    initialState: navigationInitialState,
    reducers: {
        setVisibleItemKeys: (state, action: PayloadAction<string[]>) => {
            state.visibleItemKeys = Array.from(new Set(action.payload)).filter((key) =>
                DEFAULT_SIDEBAR_ITEM_KEYS.includes(key)
            );
        },
    },
});

export const configStore = configureStore({
    reducer: {
        config: configSlice.reducer,
        course: courseSlice.reducer,
        term: termSlice.reducer,
        navigation: navigationSlice.reducer,
    },
});

let persistedTermSelection = termInitialState.selectedTermId;
let persistedSidebarItems = navigationInitialState.visibleItemKeys;
configStore.subscribe(() => {
    if (typeof localStorage === "undefined") return;
    const state = configStore.getState();
    const nextSelection = state.term.selectedTermId;
    const nextSidebarItems = state.navigation.visibleItemKeys;
    try {
        if (nextSelection !== persistedTermSelection) {
            persistedTermSelection = nextSelection;
            if (nextSelection === null) {
                localStorage.removeItem(TERM_FILTER_STORAGE_KEY);
            } else {
                localStorage.setItem(TERM_FILTER_STORAGE_KEY, String(nextSelection));
            }
        }
        if (nextSidebarItems !== persistedSidebarItems) {
            persistedSidebarItems = nextSidebarItems;
            localStorage.setItem(SIDEBAR_ITEMS_STORAGE_KEY, JSON.stringify(nextSidebarItems));
        }
    } catch {
        // Persistence is optional; Redux remains the source of truth for this session.
    }
});

export type ConfigState = ReturnType<typeof configStore.getState>
export type ConfigDispatch = typeof configStore.dispatch
