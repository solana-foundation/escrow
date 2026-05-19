import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/components/app-layout';
import { AppProviders } from '@/components/app-providers';
import { CreateEscrowRoute } from '@/routes/create-escrow';
import { Dashboard } from '@/routes/dashboard';
import { ManageEscrowRoute } from '@/routes/manage-escrow';
import { OperateEscrowRoute } from '@/routes/operate-escrow';

export function App() {
    return (
        <AppProviders>
            <Routes>
                <Route
                    path="/"
                    element={
                        <AppLayout>
                            <Dashboard />
                        </AppLayout>
                    }
                />
                <Route
                    path="/create"
                    element={
                        <AppLayout>
                            <CreateEscrowRoute />
                        </AppLayout>
                    }
                />
                <Route
                    path="/manage"
                    element={
                        <AppLayout>
                            <ManageEscrowRoute />
                        </AppLayout>
                    }
                />
                <Route
                    path="/operate"
                    element={
                        <AppLayout>
                            <OperateEscrowRoute />
                        </AppLayout>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </AppProviders>
    );
}
