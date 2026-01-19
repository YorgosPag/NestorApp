'use client';

/**
 * 🐛 DEBUG PAGE - Token Info
 *
 * TEMPORARY page for debugging custom claims.
 * DELETE after verification!
 *
 * @route /debug/token-info
 */

import { useAuth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TokenInfoPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>🔄 Loading Token Info...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <Card>
          <CardHeader>
            <CardTitle>❌ Not Authenticated</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to view token information.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get custom claims from user object
  const customClaims = {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    // These should be available from Firebase custom claims
    globalRole: user.globalRole,
    companyId: user.companyId,
    permissions: user.permissions,
    mfaEnrolled: user.mfaEnrolled,
  };

  return (
    <div className="container mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle>🔐 Token Info - Custom Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">User Object:</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(customClaims, null, 2)}
              </pre>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-2">Full User Object (Raw):</h3>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold text-lg mb-2">🎯 Key Debug Info:</h3>
              <ul className="space-y-2">
                <li><strong>UID:</strong> {user.uid}</li>
                <li><strong>Email:</strong> {user.email}</li>
                <li>
                  <strong>Global Role:</strong>{' '}
                  <span className={user.globalRole === 'super_admin' ? 'text-green-600 font-bold' : 'text-red-600'}>
                    {user.globalRole || '❌ MISSING!'}
                  </span>
                </li>
                <li>
                  <strong>Company ID:</strong>{' '}
                  {user.companyId || '❌ MISSING!'}
                </li>
                <li>
                  <strong>Permissions Count:</strong>{' '}
                  {user.permissions?.length || 0}
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
