/*!
 * Distil — hearing clinic patient management & intake system
 *
 * Copyright (c) 2026 Kurt Mooney. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL. This source code is the exclusive property of
 * the copyright holder. Unauthorized copying, distribution, modification, or
 * use of this file, in whole or in part, via any medium, is strictly
 * prohibited without the prior written permission of the copyright holder.
 * See the LICENSE file at the repository root for full terms.
 */

// Admin-denied fallback (backlog #40e — extracted from Distil.jsx
// renderAdminDenied). Defense-in-depth for the admin-only views: the nav
// already hides them for non-admins (and RLS rejects the writes), but the
// render sites guard too so a non-admin who reaches the view by any other
// path sees this instead of the editor.

import React from "react";

export default function AdminDenied() {
  return (
    <>
      <div className="topbar">
        <div>
          <div className="topbar-title">Admin access required</div>
          <div className="topbar-sub">This area is restricted to administrators.</div>
        </div>
      </div>
      <div className="content">
        <div style={{maxWidth:560,margin:"48px auto",textAlign:"center",color:"#6b7280"}}>
          <div style={{fontSize:40,marginBottom:12}}>🔒</div>
          <div style={{fontSize:15,fontWeight:600,color:"#374151",marginBottom:6}}>You don't have access to this page</div>
          <div style={{fontSize:13}}>Catalog, pricing, insurance plans, and provider management are limited to admin accounts. Contact your administrator if you need access.</div>
        </div>
      </div>
    </>
  );
}
